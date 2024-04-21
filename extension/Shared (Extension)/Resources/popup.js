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
					status = newStatus;
					log(`Set status to ${newStatus}`);
				} else {
					log("Unable to get status");
					status = "Unknown";
				}
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

try {
	const version = await browser.runtime.sendMessage({ type: "getVersion" });
	if (version) {
		setElemText("#version", version);
		log(`Set version to ${version}`);
	} else {
		log("Unable to get version");
	}
} catch (error) {
	log(`Error getting version: ${error}`);
}

try {
	const config = await browser.runtime.sendMessage({ type: "getConfig" });
	if (config) {
		setElemText("#host", config?.apiHost);
		log("Loaded config");
		log(`Using API host ${config?.apiHost}`)
	} else {
		log("Unable to load config");
	}
} catch (error) {
	log(`Error loading config: ${error}`);
}

setInterval(() => {
	updateStatus();
}, 1000);

updateStatus();
