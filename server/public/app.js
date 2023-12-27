window.addEventListener("load", () => {
	const playerSelect = document.querySelector("#players");
	const players = new Set();
	const nameInput = document.querySelector("#name-input");
	const syncButton = document.querySelector("#sync");
	const wordsInput = document.querySelector("#new-word");
	const wordsList = document.querySelector("#words");
	const words = JSON.parse(localStorage.getItem("words") || "[]");
	const otherWords = [];

	let socket;
	let version;
	let reconnectWait = 500;
	let nameTimer;
	let syncRequestId;

	// Initialize the name input from local storage
	nameInput.value = localStorage.getItem("your-name") || "";

	// Update the user's name on the server a second after they stop typing in
	// the "You" field
	nameInput.addEventListener("input", (event) => {
		const name = event.target.value;
		clearTimeout(nameTimer);
		nameTimer = setTimeout(() => {
			socket?.send(JSON.stringify({ setName: { name } }));
			localStorage.setItem("your-name", name);
		}, 1000);
	});

	// Add a word to the list when a user hits enter in the "Add word" field
	wordsInput.addEventListener("keypress", (event) => {
		if (event.key === "Enter") {
			addWord(event.target.value);
			event.target.value = "";
		}
	});

	// Request word syncing with another player
	syncButton.addEventListener("click", () => {
		syncRequestId = `${Math.random()}`;
		socket?.send(
			JSON.stringify({
				sync: {
					from: nameInput.value,
					to: playerSelect.value,
					words,
					requestId: syncRequestId,
				},
			}),
		);
	});

	renderWords();
	connect();

	// Connect to the server websocket
	function connect() {
		const skt = new WebSocket("ws://localhost:3003/ws");

		skt.addEventListener("open", () => {
			reconnectWait = 500;
			console.log("Connected to server");
			if (nameInput.value) {
				skt.send(JSON.stringify({ setName: { name: nameInput.value } }));
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

	// Handle an incoming websocket message
	function handleMessage(message) {
		if (message.version) {
			// Reload the page if the server version has changed
			if (version === undefined) {
				version = message.version;
			} else if (version !== message.version) {
				window.location.reload();
			}
		} else if (message.joined) {
			addPlayer(message.joined);
		} else if (message.left) {
			removePlayer(message.left);
		} else if (message.sync) {
			if (message.sync.requestId && message.sync.requestId === syncRequestId) {
				otherWords.push(...message.sync.words);
				renderWords();
				syncRequestId = undefined;
			} else if (confirm(`Accept sync request from ${message.sync.from}?`)) {
				socket?.send(
					JSON.stringify({
						sync: {
							from: nameInput.value,
							to: message.sync.from,
							words,
							requestId: message.sync.requestId,
						},
					}),
				);
				otherWords.push(...message.sync.words);
				renderWords();
			}
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

	// Add a new player to the player selector
	function addPlayer(name) {
		players.add(name);
		renderPlayers();
	}

	// Remove a player from the player selector
	function removePlayer(name) {
		players.delete(name);
		renderPlayers();
	}

	// Render a word in the word list
	function renderWord(word, className) {
		const li = document.createElement("li");
		li.textContent = word;
		if (className) {
			li.className = className;
		}
		wordsList.append(li);
	}

	// Render the words and other words
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

	// Add a word to the user's word list
	function addWord(word) {
		words.push(word);
		localStorage.setItem("words", JSON.stringify(words));
		renderWords();
	}
});
