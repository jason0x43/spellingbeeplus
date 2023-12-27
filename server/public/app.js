// @ts-check

/**
 * @typedef {{
 *	 to: string;
 *	 from: string;
 *	 content:
 *	   | { setName: { name: string; } }
 *	   | { version: number; }
 *	   | { sync: { requestId: string, words: string[] } }
 *	   | { joined: string }
 *	   | { left: string }
 *	   | { error: { kind: string, message: string } }
 * }} Message
 */

window.addEventListener("load", () => {
	/** @type {Set<string>} */
	const players = new Set();
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
	/** @type {number} */
	let reconnectWait = 500;
	/** @type {number | undefined} */
	let nameTimer;
	/** @type {string | undefined} */
	let syncRequestId;

	// Initialize the name input from local storage
	nameInput.value = localStorage.getItem("your-name") || "";

	// Update the user's name on the server a second after they stop typing in
	// the "You" field
	nameInput.addEventListener("input", (event) => {
		const target = /** @type {HTMLInputElement} */ (event.target);
		const name = target.value;
		clearTimeout(nameTimer);
		nameTimer = setTimeout(() => {
			send({
				to: "server",
				from: "",
				content: { setName: { name } },
			});
			localStorage.setItem("your-name", name);
		}, 1000);
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
			from: nameInput.value,
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
		console.log('Sending message:', msg);
		socket?.send(JSON.stringify(msg));
	}

	// Connect to the server websocket
	function connect() {
		const skt = new WebSocket("ws://localhost:3003/ws");

		skt.addEventListener("open", () => {
			reconnectWait = 500;
			console.log("Connected to server");
			if (nameInput.value) {
				send({
					to: "server",
					from: "",
					content: { setName: { name: nameInput.value } },
				});
			}
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

		if ("version" in message.content) {
			// Reload the page if the server version has changed
			if (version === undefined) {
				version = message.content.version;
			} else if (version !== message.content.version) {
				window.location.reload();
			}
		} else if ("joined" in message.content) {
			addPlayer(message.content.joined);
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
			} else if (confirm(`Accept sync request from ${message.from}?`)) {
				send({
					to: message.from,
					from: nameInput.value,
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
		} else if ("error" in message.content) {
			console.log("Server error:", message);
		}
	}

	// Render the players selector
	function renderPlayers() {
		playerSelect.innerHTML = "";
		const others = Array.from(players).filter(
			(player) => player !== nameInput.value,
		);
		for (const p of others) {
			const opt = document.createElement("option");
			opt.value = p;
			opt.textContent = p;
			playerSelect.append(opt);
		}
	}

	/**
	 * Add a new player to the player selector
	 * @param {string} name
	 */
	function addPlayer(name) {
		players.add(name);
		renderPlayers();
	}

	/**
	 * Remove a player from the player selector
	 * @param {string} name
	 */
	function removePlayer(name) {
		players.delete(name);
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
