/** @typedef {import("../src/message").MessageFrom} MessageFrom */
/** @typedef {import("../src/message").MessageTo} MessageTo */
/** @typedef {import("../src/types").PlayerId} PlayerId */
/** @typedef {import("../src/types").NytGameId} NytGameId */
/** @typedef {import("../src/types").GameId} GameId */
/** @typedef {import("../src/types").GameInfo} GameInfo */
/** @typedef {import("./sbpTypes").SyncConfig} SyncConfig */
/** @typedef {import("./sbpTypes").SyncDelegate} SyncDelegate */

import { isMessageType } from "./util.js";

/** @type {WebSocket | undefined} */
let socket;

/** @type {number | undefined} */
let version;

/** @typedef {`${PlayerId}:${NytGameId}`} SyncKey */

/** @type {Set<SyncKey>} */
const syncRequests = new Set();

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

	if (isMessageType("connect", message)) {
		// Reload the page if the server version has changed
		if (version === undefined) {
			version = message.content.version;
		} else if (version !== message.content.version) {
			window.location.reload();
		}

		const playerId = delegate.getState().player.id;
		send({
			to: null,
			content: { type: "setClientId", id: playerId },
		});
		console.debug(`Sent request to set client ID to ${playerId}`);

		const name = delegate.getState().player.name;
		if (name) {
			delegate.log(`Setting name to ${name}`);
			send({
				to: null,
				content: { type: "setDisplayName", name },
			});
		}
	} else if (isMessageType("joined", message)) {
		if (message.content.id === delegate.getState().player.id) {
			// This player joined
			await delegate.updateState({
				player: {
					id: message.content.id,
					name: message.content.name,
				},
			});
			delegate.log(`Name is ${message.content.name}`);

			delegate.onConnect();
		} else {
			// Another player joined
			delegate.onJoin(message.content);
			delegate.log(`${message.content.name} joined`);
		}
	} else if (message.content.type === "left") {
		if (message.content.id !== delegate.getState().player.id) {
			const player = delegate.findPlayer(message.content.id);
			delegate.log(`${player?.name} left`);
			delegate.onLeave(message.content.id);
		}
	} else if (isMessageType("syncRequest", message)) {
		// Another player requested a sync. Send the appropriate response.
		const player = delegate.findPlayer(message.from);
		delegate.log(`${player?.name} requested to sync`);
		const syncData = delegate.onSyncRequest(message.from);
		if (syncData) {
			delegate.log(`Acknowledging request from ${player?.name}`);
			send({
				to: message.from,
				content: {
					type: "syncAccept",
					request: { ...message.content },
					words: syncData.words,
				},
			});
		} else {
			delegate.log(`Refusing request from ${player?.name}`);
			send({
				to: message.from,
				content: {
					type: "syncReject",
					gameId: message.content.gameId,
				},
			});
		}
	} else if (isMessageType("syncReject", message)) {
		// The other player refused the sync; cancel the operation.
		const requestId = getSyncKey(message.from, message.content.gameId);
		if (syncRequests.has(requestId)) {
			const player = delegate.findPlayer(message.from);
			delegate.log(`${player?.name} refused sync request`);
			delegate.onSyncRejected(message.from, message.content.gameId);
		}
	} else if (isMessageType("syncAccept", message)) {
		// The other player has accepted our sync request; verify that we have an
		// open sync request for that player and game, then add the other player's
		// words
		const requestId = getSyncKey(message.from, message.content.request.gameId);

		if (!syncRequests.has(requestId)) {
			console.warn("Not accepting unsolicited sync request:", message);
		} else {
			const player = delegate.findPlayer(message.from);
			delegate.log(`${player?.name} confirmed sync request`);
		}
	} else if (isMessageType("syncStart", message)) {
		const otherPlayer = message.content.playerIds.find(
			(p) => p !== delegate.getState().player.id,
		);
		if (otherPlayer) {
			delegate.onSync(
				otherPlayer,
				message.content.gameId,
				message.content.words,
			);
		} else {
			delegate.log(`Got sync message without other player`);
		}
	} else if (isMessageType("wordAdded", message)) {
		const activeGameId = delegate.getState().syncData.gameId;
		if (activeGameId && message.content.gameId !== activeGameId) {
			console.debug(
				"Ignoring wordAdded for inactive game:",
				message.content.gameId,
			);
			return;
		}

		if (message.content.playerId !== delegate.getState().player.id) {
			delegate.onWordAdded(message.content.word, message.content.playerId);
		}
	} else if (isMessageType("error", message)) {
		// There was an error with a request or on the server
		console.debug("Server error:", message);
		alert(`Error: ${message.content.message}`);
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
	send({ to: null, content: { type: "setDisplayName", name } });
}

/**
 * Send a request to sync words to another player
 *
 * @param {PlayerId} friendId
 * @param {NytGameId} gameId
 * @param {string[]} words
 */
export async function sendSyncRequest(friendId, gameId, words) {
	const syncKey = getSyncKey(friendId, gameId);
	syncRequests.add(syncKey);
	send({
		to: friendId,
		content: { type: "syncRequest", gameId, words },
	});
}

/**
 * Send new words for the user for the given game.
 *
 * The server will update all active synced games. For example, if user A has
 * synced with users B and C for a given game, then if user A sends words, the
 * server will add those words to the synced games for B and C (if either of
 * them are missing the words).
 *
 * @param {GameId} gameId
 * @param {string} word
 */
export async function sendWord(gameId, word) {
	send({
		to: null,
		content: { type: "addWord", gameId, word },
	});
}

/**
 * @param {SyncConfig} config
 * @param {GameId} gameId
 * @returns {Promise<GameInfo | null>}
 */
export async function getGameInfo(config, gameId) {
	const resp = await fetch(`https://${config.apiHost}/game/${gameId}`, {
		method: "GET",
		headers: {
			"x-api-key": config.apiKey,
		},
	});
	return await resp.json();
}

/**
 * @param {PlayerId} player
 * @param {NytGameId} game
 * @returns {SyncKey}
 */
function getSyncKey(player, game) {
	return `${player}:${game}`;
}
