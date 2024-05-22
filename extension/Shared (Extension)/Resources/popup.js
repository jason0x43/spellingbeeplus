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

const version = await getNativeInfo("version", "getVersion");
setElemText("#version", version);
