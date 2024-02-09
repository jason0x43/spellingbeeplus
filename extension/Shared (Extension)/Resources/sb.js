import { def } from "./util.js";

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
 * Get the player's progress rank element.
 *
 * @returns {Element}
 */
export function getProgressBar() {
	return def(document.querySelector(".sb-progress-bar"));
}
