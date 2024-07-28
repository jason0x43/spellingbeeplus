import { click, def, h, selDiv, wait } from "./util.js";

/** @typedef {import("./sbpTypes").GameData} GameData */
/** @typedef {import("../src/message").ClientId} ClientId */

/** The element containing the player's current progress rank. */
export const sbProgressRank = "sb-progress-rank";
/** The element marking the player's progress on the progress bar. */
export const sbProgressMarker = "sb-progress-marker";
/** The element containing the value of the player's progress. */
export const sbProgressValue = "sb-progress-value";

/**
 * Get the NYT user ID
 *
 * @returns {ClientId}
 */
export function getUserId() {
	const cookies = document.cookie.split(/;\s*/);
	for (const cookie of cookies) {
		if (cookie.startsWith("nyt-jkidd=")) {
			const val = cookie.slice("nyt-jkidd=".length);
			const params = new URLSearchParams(val);
			return /** @type {ClientId} */ (params.get("uid"));
		}
	}

	throw new Error("No user ID");
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
	return Array.from(getWordList().querySelectorAll(".sb-anagram")).map(
		(node) => def(node.textContent).trim(),
	);
}

/**
 * Get the rank element.
 *
 * @returns {HTMLElement}
 */
export function getRank() {
	return def(document.querySelector(`.${sbProgressRank}`));
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
		click(letters[letter]);
		await wait(20);
	}

	click(enter);

	while (document.querySelector('[data-testid="sb-input"]')) {
		await wait(100);
	}
}

export async function clearWord() {
	const del = def(
		selDiv(".sb-controls .hive-actions > .hive-action__delete"),
	);

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
		/** @type {Promise<GameData>} */
		return new Promise((resolve) => {
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
}

/**
 * @param {string[]} words
 */
export function getWordStats(words) {
	/** @type {Record<string, number[]>} */
	const firstLetters = {};
	/** @type {Record<string, number>} */
	const digraphs = {};

	for (const word of words) {
		const firstLetter = word[0];
		firstLetters[firstLetter] ??= [];
		firstLetters[firstLetter][word.length] ??= 0;
		firstLetters[firstLetter][word.length]++;

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

	const dots = def(document.querySelectorAll('.sb-progress-dots .sb-progress-dot'));
	let currentIndex = 0;
	for (const dot of dots) {
		if (!dot.classList.contains('completed')) {
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
