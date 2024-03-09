import { click, def, selDiv, wait } from "./util.js";

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
 * @param {string[]} words
 */
export async function addWords(words) {
	for (const word of words) {
		await addWord(word);
		await wait(100);
	}
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
}
