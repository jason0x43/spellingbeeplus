import { click, def, h, selDiv, wait } from "./util.js";

/** @typedef {import("./sbpTypes").GameData} GameData */
/** @typedef {import("./sbTypes").GameState} GameState */
/** @typedef {import("./sbpTypes").Rank} Rank */
/** @typedef {import("./sbpTypes").SbState} SbState */
/** @typedef {import("./sbTypes").LatestsResponse} LatestsResponse */
/** @typedef {import("../src/types").PlayerId} PlayerId */
/** @typedef {import("../src/types").NytGameId} NytGameId */

/** The element containing the player's current progress rank. */
export const sbProgressRank = "sb-progress-rank";
/** The element marking the player's progress on the progress bar. */
export const sbProgressMarker = "sb-progress-marker";
/** The element containing the value of the player's progress. */
export const sbProgressValue = "sb-progress-value";

/**
 * Get the NYT user ID.
 *
 * When no NYT ID is available (anonymous / not logged in), generate a
 * persistent, device-scoped fake ID stored in localStorage.
 *
 * @returns {PlayerId}
 */
export function getUserId() {
	const cookies = document.cookie.split(/;\s*/);
	for (const cookie of cookies) {
		if (!cookie.startsWith("nyt-jkidd=")) {
			continue;
		}

		const val = cookie.slice("nyt-jkidd=".length);
		const params = new URLSearchParams(val);
		const idStr = params.get("uid");
		// uid will be '0' for anonymous user
		if (!idStr || idStr === "0") {
			continue;
		}

		const id = Number(idStr);
		if (Number.isInteger(id) && id > 0) {
			return /** @type {PlayerId} */ (id);
		}
	}

	try {
		const storageKeys = Object.keys({ ...localStorage });
		for (const key of storageKeys) {
			if (!key.startsWith("games-state-spelling_bee/")) {
				continue;
			}

			const parts = key.split("/");
			const idStr = parts[1];
			// id will be ANON for anonymous user
			if (!idStr || idStr === "ANON") {
				continue;
			}

			const id = Number(idStr);
			if (Number.isInteger(id) && id > 0) {
				return /** @type {PlayerId} */ (id);
			}
		}
	} catch {
		// localStorage may be unavailable in some contexts
	}

	return getOrCreateAnonId();
}

/**
 * @returns {PlayerId}
 */
function getOrCreateAnonId() {
	const anonIdKey = "sbp-anon-id";
	try {
		const stored = localStorage.getItem(anonIdKey);
		const storedId = stored === null ? NaN : Number(stored);
		if (Number.isInteger(storedId) && storedId < 0) {
			return /** @type {PlayerId} */ (storedId);
		}

		const anonId = generateAnonId();
		localStorage.setItem(anonIdKey, `${anonId}`);
		return anonId;
	} catch {
		return generateAnonId();
	}
}

/**
 * @returns {PlayerId}
 */
function generateAnonId() {
	/** @type {number} */
	let rand;
	try {
		const arr = new Uint32Array(1);
		crypto.getRandomValues(arr);
		rand = arr[0] ?? 0;
	} catch {
		rand = Math.floor(Math.random() * 0xffffffff);
	}

	// Keep fake IDs negative so the client can treat them as "not logged in".
	// Avoid 0 and -1, which have special meaning in a few places.
	const anonId = -(2 + (rand % 1999999998));
	return /** @type {PlayerId} */ (anonId);
}

/**
 * Get the word drawer.
 *
 * @returns {Element}
 */
export function getDrawer() {
	return def(document.querySelector(".sb-wordlist-drawer"));
}

/**
 * Get the outer word list container element.
 *
 * @returns {Element}
 */
export function getWordListOuter() {
	return def(document.querySelector(".sb-wordlist-box"));
}

/**
 * Get the inner word list container element.
 *
 * @returns {Element}
 */
export function getWordListInner() {
	return def(document.querySelector(".sb-wordlist-window"));
}

/**
 * Get the word list.
 *
 * @returns {Element}
 */
export function getWordList() {
	return def(document.querySelector(".sb-wordlist-items-pag"));
}

/**
 * Get the visible words.
 *
 * @returns {string[]}
 */
export function getWords() {
	return Array.from(getWordList().querySelectorAll(".sb-anagram")).map((node) =>
		def(node.textContent).trim(),
	);
}

/**
 * Get the current rank.
 *
 * @returns {Rank}
 */
export function getRank() {
	const currentRank = def(
		document.body.querySelector(".sb-modal-ranks__current"),
	);
	const rank =
		def(currentRank.querySelector(".sb-modal-ranks__rank-title .current-rank"))
			.textContent ?? "";
	return /** @type {Rank} */ (rank.trim());
}

/**
 * Highlight a word.
 *
 * @param {string} word
 */
export function hightlightWord(word) {
	for (const wordElem of getWordList().querySelectorAll(".sb-anagram")) {
		const text = def(wordElem.textContent).trim();
		if (text === word) {
			wordElem.classList.add("sbp-highlight");
		}
	}
}

/**
 * Unhighlight all words.
 */
export function clearHighlights() {
	for (const wordElem of getWordList().querySelectorAll(".sb-anagram")) {
		wordElem.classList.remove("sbp-highlight");
	}
}

/**
 * Get the player's progress rank element.
 *
 * @returns {Element}
 */
export function getProgressBar() {
	return def(document.querySelector(".sb-progress-bar"));
}

/**
 * Get the controls container
 *
 * @returns {Element}
 */
export function getControls() {
	return def(document.querySelector(".sb-controls"));
}

/**
 * Get the hive actions buttons container
 *
 * @returns {Element}
 */
export function getHiveActions() {
	return def(document.querySelector(".sb-controls .hive-actions"));
}

/**
 * @param {string} word
 */
export async function addWord(word) {
	const hive = def(selDiv(".sb-controls .hive"));

	/** @type {{ [letter: string]: HTMLElement }} */
	const letters = {};
	for (const cell of hive.querySelectorAll(".hive-cell")) {
		letters[def(cell.textContent)] = /** @type {HTMLElement} */ (
			cell.firstChild
		);
	}

	const enter = def(
		selDiv(".sb-controls .hive-actions > .hive-action__submit"),
	);

	for (const letter of word) {
		if (letters[letter]) {
			click(letters[letter]);
			await wait(20);
		}
	}

	click(enter);

	while (document.querySelector('[data-testid="sb-input"]')) {
		await wait(100);
	}
}

export async function clearWord() {
	const del = def(selDiv(".sb-controls .hive-actions > .hive-action__delete"));

	while (document.querySelector('[data-testid="sb-input"]')) {
		click(del);
		await wait(50);
	}
}

/**
 * Get the game data from the host page.
 */
export async function getGameData() {
	async function getData() {
		/** @type {GameData} */
		const data = await new Promise((resolve) => {
			const script = h(
				"script",
				"postMessage({ gameData: window.gameData.today })",
			);

			/** @type {(event: MessageEvent) => void} */
			const listener = (event) => {
				if (event.data?.gameData) {
					console.debug("got message with game data");
					window.removeEventListener("message", listener);
					resolve(event.data.gameData);
				}
			};

			window.addEventListener("message", listener);

			console.debug("injecting script");
			document.body.append(script);
		});

		return data;
	}

	let tries = 3;
	while (tries > 0) {
		tries--;

		const data = await getData();
		if (data) {
			return data;
		}

		await new Promise((resolve) => setTimeout(resolve, 500));
	}

	throw new Error("Couldn't get game data");
}

/**
 * @param {string[]} [words]
 */
export function getWordStats(words) {
	if (!words) {
		words = getWords();
	}

	/** @type {Record<string, number[]>} */
	const firstLetters = {};
	/** @type {Record<string, number>} */
	const digraphs = {};

	for (const word of words) {
		const firstLetter = word[0];
		if (firstLetter) {
			const firstLetterArr = firstLetters[firstLetter] ?? [];
			firstLetters[firstLetter] = firstLetterArr;

			const firstLetterLen = firstLetters[firstLetter][word.length] ?? 0;
			firstLetters[firstLetter][word.length] = firstLetterLen + 1;
		}

		const digraph = word.slice(0, 2);
		digraphs[digraph] ??= 0;
		digraphs[digraph]++;
	}

	return { firstLetters, digraphs };
}

/**
 * @returns {{ score: number, distance: number } | undefined}
 */
export function getNextRank() {
	const table = def(document.querySelector("table.sb-modal-ranks__list"));
	const rows = Array.from(table.querySelectorAll("tr")).reverse();

	const current = rows.findIndex((row) =>
		row.classList.contains("sb-modal-ranks__current"),
	);

	if (current === -1) {
		return;
	}

	const next = current + 1;
	if (!rows[next]) {
		return;
	}

	const points = /** @type {Element} */ (
		rows[next].querySelector(".sb-modal-ranks__rank-points")
	);
	const score = Number(points.textContent);

	const dots = def(
		document.querySelectorAll(".sb-progress-dots .sb-progress-dot"),
	);
	let currentIndex = 0;
	for (const dot of dots) {
		if (!dot.classList.contains("completed")) {
			break;
		}
		currentIndex++;
	}

	// 100% / 8 steps
	const delta = 100 / 8;
	const distance = delta * (currentIndex + 1);

	return { score, distance };
}

export function getCongratsPane() {
	return def(
		document.querySelector("#portal-game-moments .pz-moment__congrats"),
	);
}

export function getGamePane() {
	return def(document.querySelector("#js-hook-game-wrapper .pz-game-screen"));
}

/**
 * @returns {boolean}
 */
export function isCongratsPaneOpen() {
	const congratsPane = getCongratsPane();
	return congratsPane.classList.contains("on-stage");
}

/**
 * @returns {void}
 */
export function closeCongratsPane() {
	const congratsPane = getCongratsPane();
	const gamePane = getGamePane();

	congratsPane.classList.remove("on-stage");
	gamePane.classList.add("on-stage");
}

/**
 * @param {number} gameId
 * @returns {Promise<GameState>}
 */
async function getGameState(gameId) {
	const params = new URLSearchParams({ puzzle_ids: `${gameId}` });
	const resp = await fetch(
		`https://www.nytimes.com/svc/games/state/spelling_bee/latests?${params}`,
	);

	if (!resp.ok) {
		throw new Error("Failed to get game state");
	}

	/** @type {LatestsResponse} */
	const data = await resp.json();

	if (!data.states[0]) {
		throw new Error(`Invalid gameId ${gameId}`);
	}

	return data.states[0];
}

/**
 * Upload words to an NYT game.
 *
 * @param {NytGameId} gameId
 * @param {string[]} words
 * @returns {Promise<string[]>}
 */
export async function uploadWords(gameId, words) {
	const data = await getGameState(gameId);
	const newWords = [];

	for (const word of words) {
		if (!data.game_data.answers.includes(word)) {
			newWords.push(word);
		}
	}

	if (newWords.length === 0) {
		return newWords;
	}

	data.game_data.answers.push(...newWords);
	data.timestamp = Math.floor(Date.now() / 1000);

	const resp = await fetch("https://www.nytimes.com/svc/games/state", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(data),
	});

	if (!resp.ok) {
		const text = await resp.text();
		throw new Error(`Failed to set game state: ${text}`);
	}

	return newWords;
}

/**
 * Add words to a locally stored NYT game, as for an anonymous user.
 *
 * @param {{
 *   gameId: NytGameId;
 *   words: string[];
 *   answers: string[];
 *   pangrams: string[];
 * }} input
 * @returns {Promise<void>}
 */
export async function updateAnonGame({ gameId, words, answers, pangrams }) {
	const gameStr = localStorage.getItem("games-state-spelling_bee/ANON");
	const now = new Date();

	/** @type {SbState} */
	let gameState;

	if (gameStr) {
		gameState = JSON.parse(gameStr);
		let state = gameState.states.find(
			(state) => state.puzzleId === `${gameId}`,
		);
		if (!state) {
			state = {
				puzzleId: `${gameId}`,
				data: {
					answers: words,
					isRevealed: false,
					rank: computeScoreAndRank({ words, answers, pangrams }).rank,
					isPlayingArchive: false,
				},
				schemaVersion: "0.31.0",
				timestamp: now.getTime(),
				printDate: now.toISOString().slice(0, 10),
			};
			gameState.states.push(state);
		} else {
			for (const word of words) {
				if (!state.data.answers.includes(word)) {
					state.data.answers.push(word);
				}
			}
			state.timestamp = now.getTime();
		}
	} else {
		gameState = {
			states: [
				{
					puzzleId: `${gameId}`,
					data: {
						answers: words,
						isRevealed: false,
						rank: "Beginner",
						isPlayingArchive: false,
					},
					schemaVersion: "0.31.0",
					timestamp: now.getTime(),
					printDate: now.toISOString().slice(0, 10),
				},
			],
		};
	}

	localStorage.setItem(
		"games-state-spelling_bee/ANON",
		JSON.stringify(gameState),
	);
}

/**
 * Compute the score and rank of a given set of words.
 *
 * @param {{ words: string[], answers: string[], pangrams: string[] }} input
 * @returns {{ score: number; rank: Rank }}
 */
export function computeScoreAndRank({ words, answers, pangrams }) {
	const total = computeScore(answers, pangrams);
	const score = computeScore(words, pangrams);
	const rank = computeRank(score, total);
	return { score, rank };
}

/**
 * Compute the score of a set of words
 *
 * @param {string[]} words
 * @param {string[]} pangrams
 */
function computeScore(words, pangrams) {
	let score = 0;
	for (const word of words) {
		let wordValue = word.length === 4 ? 1 : word.length;
		if (pangrams.includes(word)) {
			wordValue += 7;
		}
		score += wordValue;
	}
	return score;
}

/**
 * Compute a given score's rank in the daily game
 *
 * @param {number} score
 * @param {number} total
 * @returns {Rank}
 */
function computeRank(score, total) {
	if (score < Math.round(total * 0.018348)) {
		return "Beginner";
	}
	if (score < Math.round(total * 0.050458)) {
		return "Good Start";
	}
	if (score < Math.round(total * 0.077981)) {
		return "Moving Up";
	}
	if (score < Math.round(total * 0.151376)) {
		return "Good";
	}
	if (score < Math.round(total * 0.252293)) {
		return "Solid";
	}
	if (score < Math.round(total * 0.399082)) {
		return "Nice";
	}
	if (score < Math.round(total * 0.5)) {
		return "Great";
	}
	if (score < Math.round(total * 0.701834)) {
		return "Amazing";
	}
	if (score < total) {
		return "Genius";
	}
	return "Queen Bee";
}
