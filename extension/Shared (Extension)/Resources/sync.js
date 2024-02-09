/** @type {WebSocket | undefined} */
let socket;

/** @type {number | undefined} */
let version;

/** @type {string | undefined} */
let clientId;

/** @type {string | undefined} */
let syncRequestId;

/** @type {string[]} */
const otherWords = [];

/** @type {Map<string, string>} */
const players = new Map();

/** @type {string[]} */
const words = JSON.parse(localStorage.getItem("words") || "[]");

let reconnectWait = 500;
let playerName = localStorage.getItem("your-name") || "Player";

/**
 * Get a token
 *
 * @returns {Promise<string>}
 */
async function getToken() {
	const resp = await fetch("https://localhost:9001/token", {
		method: "GET",
		headers: {
			"x-api-key": "789C231E-08EA-4846-9A4D-43422F3993E0",
		},
	});
	const text = await resp.text();
	console.log(`Got token response: ${text}`);
	const json = JSON.parse(text);
	return json.token;
}

/**
 * Send a message over the active socket
 *
 * @param {Message} msg
 */
function send(msg) {
	console.log("Sending message:", msg);
	socket?.send(JSON.stringify(msg));
}

function renderWords() {
	console.log("rendering words");
}

/**
 * Handle an incoming websocket message
 * @param {Message} message
 */
function handleMessage(message) {
	console.log("Handling message:", message);

	if ("connect" in message.content) {
		// Reload the page if the server version has changed
		if (version === undefined) {
			version = message.content.connect.version;
		} else if (version !== message.content.connect.version) {
			window.location.reload();
		}

		clientId = message.content.connect.id;

		if (playerName) {
			send({ content: { setName: playerName } });
		}
	} else if ("joined" in message.content) {
		if (message.content.joined.id === clientId) {
			playerName = message.content.joined.name;
			localStorage.setItem("your-name", playerName);
		} else {
			// addPlayer(message.content.joined);
		}
	} else if ("left" in message.content) {
		// removePlayer(message.content.left);
	} else if ("sync" in message.content) {
		if (
			message.content.sync.requestId &&
			message.content.sync.requestId === syncRequestId
		) {
			otherWords.push(...message.content.sync.words);
			renderWords();
			syncRequestId = undefined;
		} else {
			const otherPlayer = players.get(message.from ?? "");
			if (confirm(`Accept sync request from ${otherPlayer}?`)) {
				send({
					to: message.from,
					from: clientId,
					content: {
						sync: {
							words,
							requestId: message.content.sync.requestId,
						},
					},
				});
				otherWords.push(...message.content.sync.words);
				renderWords();
			}
		}
	} else if ("error" in message.content) {
		console.log("Server error:", message);
		alert(`Error: ${message.content.error.message}`);
		if (message.content.error.kind === "nameUnavailable") {
			// nameInput.value = name;
		}
	}
}
// Connect to the server websocket
export async function connect() {
	const token = await getToken();
	console.log(`Connecting to socket with token: ${token}`);
	const skt = new WebSocket(`wss://localhost:9001/ws?token=${token}`);

	skt.addEventListener("open", () => {
		reconnectWait = 500;
		console.log("Connected to server");
	});

	skt.addEventListener("close", () => {
		console.warn("Connection closed");
		socket = undefined;
		setTimeout(() => {
			connect().catch((error) => {
				console.warn("connection error:", error);
			});
		}, reconnectWait);
		reconnectWait *= 1.5;
	});

	skt.addEventListener("error", () => {
		console.warn("Connection error");
	});

	skt.addEventListener("message", (event) => {
		console.log("Received message:", event.data);
		try {
			handleMessage(JSON.parse(event.data));
		} catch (error) {
			console.warn(`${error}`);
		}
	});

	socket = skt;
}
