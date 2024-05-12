import { getNativeInfo } from "./info.js";

/** @type {string | undefined} */
let status = undefined;

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

function updateStatus() {
	browser.runtime
		.sendMessage({ type: "getStatus" })
		.then((newStatus) => {
			if (newStatus !== status) {
				if (newStatus) {
					setElemText("#status", newStatus);
					log(`Set status to ${newStatus}`);
				} else {
					setElemText("#status", "Unavailable");
					log("Waiting for status...");
				}
				status = newStatus;
			}
		})
		.catch((error) => {
			log(`Error getting status: ${error}`);
		});
}

/**
 * @param {string} message
 */
function log(message) {
	const log = document.querySelector("#log");
	const entry = document.createElement("p");
	entry.textContent = message;
	log?.append(entry);
}

log("Starting up...");

await new Promise((resolve) => setTimeout(resolve, 1000));

setInterval(() => {
	updateStatus();
}, 1000);

updateStatus();

const version = await getNativeInfo("version", "getVersion");
setElemText("#version", version);
log(`Set version to ${version}`);

const config = await getNativeInfo("config", "getConfig");
setElemText("#host", config?.apiHost);
log("Loaded config");
log(`Using API host ${config?.apiHost}`);
