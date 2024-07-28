import events from "node:events";
import type {
	AppLocals,
	Client,
	Request,
	Response,
	Websocket,
} from "./server.js";
import { createId } from "@paralleldrive/cuid2";
import { ClientId, MessageTo, messageFrom } from "./message.js";
import { log } from "./util.js";
import { promises as fs } from "node:fs";
import { extname } from "node:path";

const serverId = "00000" as ClientId;

export function connect(request: Request, response: Response) {
	response.upgrade({
		locals: request.app.locals,
	});
}

export async function getFile(request: Request, response: Response) {
	const file = request.params.file;
	try {
		const source = await fs.readFile(`public/${file}`, "utf-8");
		const ext = extname(file).slice(1);
		response.type(ext).send(source);
	} catch (error) {
		response.status(404).send("Not found");
	}
}

export function getToken(request: Request, response: Response) {
	const token = createId();
	const expiry = new Date();
	expiry.setSeconds(expiry.getSeconds() + 10);
	request.app.locals.tokens.set(token, expiry);
	response.json({ token });
}

export async function hello(_request: Request, response: Response) {
	response.send("Hello, world!");
}

export async function ws(socket: Websocket) {
	const locals = socket.context.locals as AppLocals;
	const messages = events.on(socket, "message") as MessagesIterator;

	// Send the client the current server version, which may cause the client to
	// reload
	socket.send(
		messageFrom(serverId, {
			connect: {
				version: locals.version,
			},
		}),
	);

	let client: Client = {
		id: "" as ClientId,
		name: "",
	};

	// Wait for the client reply with its ID
	while (!client.id) {
		log.debug(`Waiting for SetClientId message...`);
		const msg = await nextMessage(messages);
		if (!msg) {
			log.warn("Stream ended without setting ID");
			return;
		}

		if ("setClientId" in msg.content) {
			log.debug(`Client ID is ${msg.content.setClientId}`);

			const clientId = msg.content.setClientId;

			if (locals.clients.has(clientId)) {
				// A client record already exists for the client's ID
				client = locals.clients.get(clientId)!;
			} else {
				// Use the default record for this client ID
				client.id = clientId;
				locals.clients.set(client.id, client);
			}

			locals.connections.set(socket, client.id);
		}
	}

	// After the ID has been negotiated, add a close handler that will remove
	// the client from the clients list when the socket closes
	socket.once("close", () => {
		locals.connections.delete(socket);

		// Tell other clients that one left
		log.debug(`Notifying other clients that ${client.id} left...`);
		for (const [otherClient, _] of locals.connections) {
			otherClient.send(
				messageFrom(serverId, {
					left: client.id,
				}),
			);
		}
	});

	// Tell the new client about any existing clients
	log.debug(`Notifying ${client.id} of existing clients...`);
	for (const [_, otherClient] of locals.clients) {
		if (otherClient.id !== client.id) {
			socket.send(
				messageFrom(serverId, {
					joined: otherClient,
				}),
			);
		}
	}

	if (client.name) {
		// The client ID alreayd has a name; tell it to the newly connected client
		socket.send(
			messageFrom(serverId, {
				joined: client,
			}),
		);
	} else {
		// Wait for the client to set its name
		while (!client.name) {
			log.debug(`Waiting for name from ${client.id}...`);
			const msg = await nextMessage(messages);
			if (!msg) {
				log.warn("Stream ended without setting name");
				return;
			}

			if ("setName" in msg.content) {
				client.name = msg.content.setName;
				log.debug(`Client ${client.id} is named ${client.name}`);
			}
		}
	}

	// Tell existing clients about the new client
	log.debug(
		`Notifying other clients that ${client.name} (${client.id}) joined...`,
	);
	for (const [otherSocket, _] of locals.connections) {
		if (otherSocket !== socket) {
			otherSocket.send(
				messageFrom(serverId, {
					joined: client,
				}),
			);
		}
	}

	// Handle new messages as they come in
	for await (const msg of messageIterator(messages)) {
		if ("close" in msg.content) {
			// A client is disconnecting
			socket.close();
			break;
		} else if ("setName" in msg.content) {
			// A client is updating its display name
			client.name = msg.content.setName;
			log.debug(
				`Set ${client.id} name to ${client.name}; notifying clients...`,
			);

			for (const [otherSocket, _] of locals.connections) {
				otherSocket.send(
					messageFrom(serverId, {
						joined: client,
					}),
				);
			}
		} else if (msg.to) {
			// Forward any other messages to the proper receiver
			for (const [otherSocket, otherClientId] of locals.connections) {
				if (otherClientId === msg.to) {
					otherSocket.send(messageFrom(client.id, msg.content));
					log.debug(`Sent message from ${client.id} to ${msg.to}`);
				}
			}
		} else {
			log.warn(`Not handling message from ${client.id}:`, msg);
		}
	}
}

// HyperExpress websocket's on(message) handler is called with the message and
// an isBinary flag.
type MessagesIterator = AsyncIterableIterator<
	[message: string, isBinary: boolean]
>;

/**
 * Return the next message from a messages stream
 */
async function nextMessage(
	messages: MessagesIterator,
): Promise<MessageTo | undefined> {
	const msgVal = await messages.next();
	return msgVal.done
		? undefined
		: MessageTo.parse(JSON.parse(msgVal.value[0]));
}

/**
 * An iterator that returns parsed messages
 */
async function* messageIterator(
	messages: MessagesIterator,
): AsyncIterable<MessageTo> {
	for await (const msg of messages) {
		yield MessageTo.parse(JSON.parse(msg[0]));
	}
}
