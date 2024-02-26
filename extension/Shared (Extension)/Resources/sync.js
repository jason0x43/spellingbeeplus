/** @typedef {import("../../../server/bindings/MessageFrom.ts").MessageFrom} MessageFrom */
/** @typedef {import("../../../server/bindings/MessageTo.ts").MessageTo} MessageTo */

/** @type {WebSocket | undefined} */
let socket;

/** @type {number | undefined} */
let version;

/** @type {string | undefined} */
let syncRequestId;

let reconnectWait = 500;

/** @type {string | null} */
let clientId = localStorage.getItem("sbp-client-id");

/**
 * Get a token
 *
 * @param {SyncConfig} config
 * @returns {Promise<string>}
 */
async function getToken(config) {
	const resp = await fetch(`https://${config.apiHost}/token`, {
		method: "GET",
		headers: {
			"x-api-key": config.apiKey,
		},
	});
	const text = await resp.text();
	console.debug(`Got token response: ${text}`);
	const json = JSON.parse(text);
	return json.token;
}

/**
 * Send a message over the active socket
 *
 * @param {MessageTo} msg
 */
function send(msg) {
	console.debug("Sending message:", msg);
	const socket = assertConnected();
	socket.send(JSON.stringify(msg));
}

/**
 * Handle an incoming websocket message
 *
 * @param {SyncDelegate} delegate
 * @param {MessageFrom} message
 */
function handleMessage(delegate, message) {
	console.debug("Handling message:", message);

	if ("connect" in message.content) {
		// Reload the page if the server version has changed
		if (version === undefined) {
			version = message.content.connect.version;
		} else if (version !== message.content.connect.version) {
			window.location.reload();
		}

		if (clientId) {
			console.debug("Received connect message with existing client ID!");
			send({
				to: null,
				content: { setClientId: clientId },
			});
			console.debug(`Sent request to set client ID to ${clientId}`);
		} else {
			clientId = message.content.connect.id;
			console.debug(`Connected as ${clientId}`);
			localStorage.setItem("sbp-client-id", clientId);
		}

		const name = delegate.getState().newName;
		if (name) {
			send({
				to: null,
				content: { setName: name },
			});
		}
	} else if ("joined" in message.content) {
		if (message.content.joined.id === clientId) {
			delegate.onName(message.content.joined);
		} else {
			delegate.onJoin(message.content.joined);
		}
	} else if ("left" in message.content) {
		delegate.onLeave(message.content.left);
	} else if ("sync" in message.content) {
		if (
			message.content.sync.requestId &&
			message.content.sync.requestId === syncRequestId
		) {
			// This is an incoming sync response that matches the current
			// syncRequestId -- perform the sync
			delegate.onSync(message.content.sync.words);
			syncRequestId = undefined;
		} else {
			// This is a new incoming sync request; if we agree to it, sync the
			// provided words and send a confirmation response
			if (delegate.onSyncRequest(message.from)) {
				send({
					to: message.from,
					content: {
						sync: {
							words: message.content.sync.words,
							requestId: message.content.sync.requestId,
						},
					},
				});
				delegate.onSync(message.content.sync.words);
			}
		}
	} else if ("error" in message.content) {
		console.debug("Server error:", message);
		alert(`Error: ${message.content.error.message}`);
		if (message.content.error.kind === "nameUnavailable") {
			// nameInput.value = name;
		}
	}
}

/**
 * Connect to the server websocket
 *
 * @param {SyncConfig} config
 * @param {SyncDelegate} delegate
 */
export async function connect(config, delegate) {
	socket?.close();
	socket = undefined;

	const token = await getToken(config);
	console.debug(`Connecting to socket with token: ${token}`);

	const skt = new WebSocket(`wss://${config.apiHost}/ws?token=${token}`);

	skt.addEventListener("open", () => {
		reconnectWait = 500;
		console.debug("Connected to server");
	});

	skt.addEventListener("close", () => {
		console.warn("Connection closed");
		socket = undefined;
		setTimeout(() => {
			connect(config, delegate).catch((error) => {
				console.warn("connection error:", error);
			});
		}, reconnectWait);
		reconnectWait *= 1.5;
	});

	skt.addEventListener("error", () => {
		console.warn("Connection error");
	});

	skt.addEventListener("message", (event) => {
		console.debug("Received message:", event.data);
		try {
			handleMessage(delegate, JSON.parse(event.data));
		} catch (error) {
			console.warn(`${error}`);
		}
	});

	socket = skt;
}

/**
 * Update the player's name
 *
 * @param {string} name
 */
export async function setName(name) {
	send({ to: null, content: { setName: name } });
}

/**
 * Update the player's name
 *
 * @param {string} friendId
 * @param {string[]} words
 */
export async function syncWords(friendId, words) {
	syncRequestId = Math.random().toString(36).slice(2);
	send({
		to: friendId,
		content: { sync: { requestId: syncRequestId, words } },
	});
}

/**
 * Check that there's an active connection
 *
 * @returns {WebSocket}
 */
function assertConnected() {
	if (!socket) {
		throw new Error("Not connected");
	}
	return socket;
}
