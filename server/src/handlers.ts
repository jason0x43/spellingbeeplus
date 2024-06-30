import events from "node:events";
import type { AppLocals, Request, Response, Websocket } from "./server.js";
import { createId } from "@paralleldrive/cuid2";
import { MessageTo, messageFrom } from "./message.js";
import { log } from "./util.js";
import { promises as fs } from "node:fs";
import { extname } from "node:path";

const serverId = "00000";

export function connect(request: Request, response: Response) {
	response.upgrade({
		locals: request.app.locals,
	});
}

export async function getFile(request: Request, response: Response) {
	const file = request.params.file;
	try {
		const source = await fs.readFile(
			`public/${file}`,
			"utf-8",
		);
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
	let clientId = createId();

	const messages = events.on(socket, "message") as MessagesIterator;
	log.debug(`Connected client at ${socket.ip} with temp ID ${clientId}`);

	// Send the client a unique ID for it to use, along with the current server
	// version, which may cause the client to reload
	socket.send(
		messageFrom(serverId, {
			connect: {
				version: locals.version,
				id: clientId,
			},
		}),
	);

	const client = {
		socket,
		name: "",
	};

	// Wait for the client to acknowledge the ID, or reply with a new one
	let idAcknowledged = false;
	while (!idAcknowledged) {
		log.debug(`Waiting for SetClientId message from ${clientId}...`);
		const msg = await nextMessage(messages);
		if (!msg) {
			log.warn("Stream ended without setting ID");
			return;
		}

		if ("setClientId" in msg.content) {
			log.debug(`Client ${clientId} changed ID to ${msg.content.setClientId}`);
			clientId = msg.content.setClientId;
			locals.clients.set(clientId, client);
			idAcknowledged = true;
		}
	}

	socket.once("close", () => {
		log.info(`Client ${clientId} disconnected`);
		locals.clients.delete(clientId);

		// Tell other clients that one left
		log.debug(`Notifying other clients that ${clientId} left...`);
		for (const [_, otherClient] of locals.clients) {
			otherClient.socket.send(
				messageFrom(serverId, {
					left: clientId,
				}),
			);
		}
	});

	// Tell the new client about any existing clients
	log.debug(`Notifying ${clientId} of existing clients...`);
	for (const [id, otherClient] of locals.clients) {
		socket.send(
			messageFrom(serverId, {
				joined: {
					id,
					name: otherClient.name,
				},
			}),
		);
	}

	// Wait for the client to set its name
	while (!client.name) {
		log.debug(`Waiting for name from ${clientId}...`);
		const msg = await nextMessage(messages);
		if (!msg) {
			log.warn("Stream ended without setting name");
			return;
		}

		if ("setName" in msg.content) {
			client.name = msg.content.setName;
			log.debug(`Client ${clientId} is named ${client.name}`);
		}
	}

	// Tell existing clients about the new client
	log.debug(
		`Notifying other clients that ${client.name} (${clientId}) joined...`,
	);
	for (const [_, otherClient] of locals.clients) {
		otherClient.socket.send(
			messageFrom(serverId, {
				joined: {
					id: clientId,
					name: client.name,
				},
			}),
		);
	}

	for await (const msg of messageIterator(messages)) {
		if ("close" in msg.content) {
			socket.close();
			return;
		}

		if ("setName" in msg.content) {
			client.name = msg.content.setName;
			log.debug(
				`Set ${clientId} name to ${client.name}; notifying other clients...`,
			);
			for (const [_, otherClient] of locals.clients) {
				otherClient.socket.send(
					messageFrom(serverId, {
						joined: {
							id: clientId,
							name: client.name,
						},
					}),
				);
			}

			continue;
		}

		if (msg.to) {
			const target = locals.clients.get(msg.to);
			if (!target) {
				log.warn(
					`Client ${clientId} tried to send message to unknown client ${msg.to}`,
				);
				continue;
			}

			target.socket.send(messageFrom(clientId, msg.content));
			log.debug(`Sent message from ${clientId} to ${msg.to}`);

			continue;
		}

		log.warn(`Not handling message from ${clientId}:`, msg);
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
	return msgVal.done ? undefined : MessageTo.parse(JSON.parse(msgVal.value[0]));
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
