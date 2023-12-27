// @ts-check

/**
 * @typedef {{
 *	 to?: string;
 *	 from?: string;
 *	 content:
 *	   | { setName: string; }
 *	   | { connect: { version: number; id: string; } }
 *	   | { sync: { requestId: string, words: string[] } }
 *	   | { joined: { id: string, name: string } }
 *	   | { left: string }
 *	   | { error: { kind: string, message: string } }
 * }} Message
 */

window.addEventListener("load", () => {
	/** @type {Map<string, string>} */
	const players = new Map();
	const playerSelect = /** @type {HTMLSelectElement} */ (
		document.querySelector("#players")
	);
	const nameInput = /** @type {HTMLInputElement} */ (
		document.querySelector("#name-input")
	);
	const syncButton = /** @type {HTMLButtonElement} */ (
		document.querySelector("#sync")
	);
	const wordsInput = /** @type {HTMLInputElement} */ (
		document.querySelector("#new-word")
	);
	const wordsList = /** @type {HTMLUListElement} */ (
		document.querySelector("#words")
	);
	/** @type {string[]} */
	const words = JSON.parse(localStorage.getItem("words") || "[]");
	/** @type {string[]} */
	const otherWords = [];

	/** @type {WebSocket | undefined} */
	let socket;
	/** @type {number | undefined} */
	let version;
	/** @type {string | undefined} */
	let clientId;
	/** @type {number} */
	let reconnectWait = 500;
	/** @type {number | undefined} */
	let nameTimer;
	/** @type {string | undefined} */
	let syncRequestId;

	// Initialize the name input from local storage
	let name = localStorage.getItem("your-name") || "";
	nameInput.value = name;

	// Update the user's name on the server a second after they stop typing in
	// the "You" field
	nameInput.addEventListener("input", (event) => {
		const target = /** @type {HTMLInputElement} */ (event.target);
		const newName = target.value;
		clearTimeout(nameTimer);
		if (newName !== name) {
			nameTimer = setTimeout(() => {
				send({
					from: clientId,
					content: { setName: newName },
				});
			}, 1000);
		}
	});

	// Add a word to the list when a user hits enter in the "Add word" field
	wordsInput.addEventListener("keypress", (event) => {
		const target = /** @type {HTMLInputElement} */ (event.target);
		if (event.key === "Enter") {
			addWord(target.value);
			target.value = "";
		}
	});

	// Request word syncing with another player
	syncButton.addEventListener("click", () => {
		syncRequestId = `${Math.random()}`;
		send({
			to: playerSelect.value,
			from: clientId,
			content: {
				sync: {
					words,
					requestId: syncRequestId,
				},
			},
		});
	});

	renderWords();
	connect();

	/**
	 * Send a message over the active socket
	 *
	 * @param {Message} msg
	 */
	function send(msg) {
		console.log("Sending message:", msg);
		socket?.send(JSON.stringify(msg));
	}

	// Connect to the server websocket
	function connect() {
		const skt = new WebSocket("ws://localhost:3003/ws");

		skt.addEventListener("open", () => {
			reconnectWait = 500;
			console.log("Connected to server");
		});

		skt.addEventListener("close", () => {
			console.warn("Connection closed");
			socket = undefined;
			setTimeout(connect, reconnectWait);
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

			if (name) {
				send({ content: { setName: nameInput.value } });
			}
		} else if ("joined" in message.content) {
			if (message.content.joined.id === clientId) {
				name = message.content.joined.name;
				localStorage.setItem("your-name", name);
			} else {
				addPlayer(message.content.joined);
			}
		} else if ("left" in message.content) {
			removePlayer(message.content.left);
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
				nameInput.value = name;
			}
		}
	}

	// Render the players selector
	function renderPlayers() {
		playerSelect.innerHTML = "";
		for (const [id, name] of players.entries()) {
			const opt = document.createElement("option");
			opt.value = id;
			opt.textContent = name;
			playerSelect.append(opt);
		}
	}

	/**
	 * Add a new player to the player selector
	 * @param {{ id: string, name: string }} player
	 */
	function addPlayer(player) {
		if (player.id === clientId) {
			return;
		}
		players.set(player.id, player.name);
		renderPlayers();
	}

	/**
	 * Remove a player from the player selector
	 * @param {string} playerId
	 */
	function removePlayer(playerId) {
		players.delete(playerId);
		renderPlayers();
	}

	/**
	 * Render a word in the word list
	 * @param {string} word
	 * @param {string} [className]
	 */
	function renderWord(word, className) {
		const li = document.createElement("li");
		li.textContent = word;
		if (className) {
			li.className = className;
		}
		wordsList.append(li);
	}

	/**
	 * Render the words and other words
	 */
	function renderWords() {
		wordsList.innerHTML = "";
		for (const word of words) {
			renderWord(word);
		}
		const newOtherWords = otherWords.filter((w) => !words.includes(w));
		for (const word of newOtherWords) {
			renderWord(word, "other-word");
		}
	}

	/**
	 * Add a word to the user's word list
	 * @param {string} word
	 */
	function addWord(word) {
		words.push(word);
		localStorage.setItem("words", JSON.stringify(words));
		renderWords();
	}
});
