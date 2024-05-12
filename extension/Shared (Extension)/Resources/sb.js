import { click, def, getNormalizedText, h, selDiv, wait } from "./util.js";

/** The element containing the player's current progress rank. */
export const sbProgressRank = "sb-progress-rank";
/** The element marking the player's progress on the progress bar. */
export const sbProgressMarker = "sb-progress-marker";
/** The element containing the value of the player's progress. */
export const sbProgressValue = "sb-progress-value";

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
 * @param {string[]} words
 * @param {string[]} pangrams
 */
export function getThresholds(words, pangrams) {
	const maxScore = words.reduce((score, word) => {
		score += word.length === 4 ? 1 : word.length;
		if (pangrams.includes(word)) {
			score += 7;
		}
		return score;
	}, 0);
	const delta = 100 / 8;

	return {
		beginner: {
			score: Math.round((2 / 100) * maxScore),
			distance: delta,
		},
		"good start": {
			score: Math.round((5 / 100) * maxScore),
			distance: delta * 2,
		},
		"moving up": {
			score: Math.round((8 / 100) * maxScore),
			distance: delta * 3,
		},
		good: {
			score: Math.round((15 / 100) * maxScore),
			distance: delta * 4,
		},
		solid: {
			score: Math.round((25 / 100) * maxScore),
			distance: delta * 5,
		},
		nice: {
			score: Math.round((48 / 100) * maxScore),
			distance: delta * 6,
		},
		great: {
			score: Math.round((50 / 100) * maxScore),
			distance: delta * 7,
		},
		amazing: {
			score: Math.round((70 / 100) * maxScore),
			distance: delta * 8,
		},
	};
}

/**
 * @returns {boolean}
 */
export function isCongratsPaneOpen() {
	return document.querySelector(".pz-moment__congrats.on-stage") != null;
}

/**
 * @returns {void}
 */
export function closeCongratsPane() {
	/** @type {HTMLButtonElement | null} */
	const button =
		document.querySelector(".on-stage .pz-moment__close") ||
		document.querySelector(".on-stage .pz-moment__close-text");

	if (button) {
		click(button);
	} else {
		console.warn("Could not find close button");
	}
}
