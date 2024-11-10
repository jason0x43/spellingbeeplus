import { getNativeInfo } from "./info.js";

/**
 * @param {string} selector
 * @param {string} text
 */
function setElemText(selector, text) {
	const elem = document.querySelector(selector);
	if (elem) {
		elem.textContent = text;
	}
}

try {
	const version = await getNativeInfo("version", "getVersion");
	setElemText("#version", version);

	const status = await getNativeInfo("status", "getStatus");
	setElemText("#status", status);
} catch (error) {
	console.warn('Error getting info:', error);
}
