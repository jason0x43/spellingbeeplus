/** @typedef {import("../src/message").MessageFrom} MessageFrom */
/** @typedef {import("../src/message").MessageTo} MessageTo */
/** @typedef {import("../src/message").ClientId} ClientId */
/** @typedef {import("./sbpTypes").SyncConfig} SyncConfig */
/** @typedef {import("./sbpTypes").SyncDelegate} SyncDelegate */

/** @type {WebSocket | undefined} */
let socket;

/** @type {number | undefined} */
let version;

/** @type {string | undefined} */
let syncRequestId;

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

	if (!socket || socket.readyState !== WebSocket.OPEN) {
		throw new Error("Not connected");
	}

	socket.send(JSON.stringify(msg));
}

/**
 * Handle an incoming websocket message
 *
 * @param {SyncDelegate} delegate
 * @param {MessageFrom} message
 */
async function handleMessage(delegate, message) {
	console.debug("Handling message:", message);

	if ("connect" in message.content) {
		// Reload the page if the server version has changed
		if (version === undefined) {
			version = message.content.connect.version;
		} else if (version !== message.content.connect.version) {
			window.location.reload();
		}

		const clientId = delegate.getState().player.id;
		send({
			to: null,
			content: { setClientId: clientId },
		});
		console.debug(`Sent request to set client ID to ${clientId}`);

		const name = delegate.getState().player.name;
		if (name) {
			send({
				to: null,
				content: { setName: name },
			});
		}
	} else if ("joined" in message.content) {
		if (message.content.joined.id === delegate.getState().player.id) {
			if (message.content.joined.name) {
				await delegate.updateState({
					player: message.content.joined,
				});
			}
		} else {
			delegate.onJoin(message.content.joined);
		}
	} else if ("left" in message.content) {
		delegate.onLeave(message.content.left);
	} else if ("noSync" in message.content) {
		// Sync was refused
		delegate.onSyncRefused(message.content.noSync);
	} else if ("sync" in message.content) {
		if (message.content.sync.requestId) {
			if (message.content.sync.requestId === syncRequestId) {
				// This is a confirmation response from a player we requested to
				// sync with -- perform the sync and clear the request ID
				delegate.onSync(message.content.sync.words);
				syncRequestId = undefined;
			} else {
				// This is a new incoming sync request; if we agree to it, sync the
				// provided words and send a confirmation response
				const gameWords = delegate.onSyncRequest(message.from);
				if (gameWords) {
					send({
						to: message.from,
						content: {
							sync: {
								words: gameWords,
								requestId: message.content.sync.requestId,
							},
						},
					});
					delegate.onSync(message.content.sync.words);
				} else {
					send({
						to: message.from,
						content: {
							noSync: message.content.sync.requestId,
						},
					});
				}
			}
		} else {
			console.warn("Ignoring invalid sync request (missing ID)");
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
	const token = await getToken(config);
	delegate.log(`Connecting to ${config.apiHost}...`);

	socket = new WebSocket(`wss://${config.apiHost}/ws?token=${token}`);

	const destroy = () => {
		if (socket) {
			socket.onopen = null;
			socket.onclose = null;
			socket.onmessage = null;
			socket.onerror = null;
			socket = undefined;
		}
	};

	const reconnect = () => {
		setTimeout(
			() => {
				connect(config, delegate).catch((error) => {
					delegate.log(`Connection error: ${error}`);
					reconnect();
				});
			},
			1000 + Math.random() * 2000,
		);
	};

	socket.onopen = () => {
		delegate.log("Connected");
		delegate.updateState({ status: "Connected" });
	};

	socket.onclose = () => {
		delegate.log("Connection closed");
		delegate.updateState({ status: "Not connected" });
		destroy();
		reconnect();
	};

	socket.onerror = () => {
		delegate.log("Connection error");
		delegate.updateState({ status: "Not connected" });
		destroy();
		reconnect();
	};

	socket.onmessage = async (event) => {
		console.debug("Received message:", event.data);
		try {
			await handleMessage(delegate, JSON.parse(event.data));
		} catch (error) {
			console.warn(error);
		}
	};
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
 * Send a request to sync words to another player
 *
 * @param {ClientId} friendId
 * @param {string[]} words
 */
export async function sendSyncRequest(friendId, words) {
	syncRequestId = Math.random().toString(36).slice(2);
	send({
		to: friendId,
		content: { sync: { requestId: syncRequestId, words } },
	});
}

/**
 * Send new words to a synced game.
 *
 * @param {ClientId} friendId
 * @param {string[]} words
 */
export async function sendWords(friendId, words) {
	syncRequestId = Math.random().toString(36).slice(2);
	send({
		to: friendId,
		content: { sync: { requestId: syncRequestId, words } },
	});
}
