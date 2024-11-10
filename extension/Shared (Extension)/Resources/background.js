/** @typedef {import("./global").Config} Config */

/** @type {string|undefined} */
let statusText;

/** @type {Config | undefined} */
let config = undefined;

browser.runtime.onMessage.addListener((request, _sender, sendResponse) => {
	console.log("Received request:", request);

	if (typeof request !== "object" || !request) {
		return;
	}

	console.log("Handling request:", request);
	console.log("Config:", config);

	if (request.type === "getConfig") {
		if (config) {
			sendResponse(config);
		} else {
			browser.runtime.sendNativeMessage(
				"application.id",
				{ type: "getConfig" },
				(response) => {
					if (response) {
						config = response;
					}
					sendResponse(response);
				},
			);
		}
	} else if (request.type === "getVersion") {
		if (config) {
			sendResponse(config.appVersion);
		} else {
			browser.runtime.sendNativeMessage(
				"application.id",
				{ type: "getConfig" },
				(response) => {
					if (response) {
						config = response;
					}
					sendResponse(response?.appVersion);
				},
			);
		}
	} else if (request.type === "setStatus") {
		statusText = request.status;
	} else if (request.type === "getStatus") {
		sendResponse(statusText);
	}

	return true;
});

browser.runtime.onMessageExternal.addListener((request, _sender) => {
	console.log("Received external request:", request);

	if (typeof request !== "object" || !request) {
		return;
	}

	console.log("Handling request:", request);
	console.log("Config:", config);

	if (request.type === "setStatus") {
		statusText = request.status;
	}

	return true;
});

console.log("Loaded service worker!");
