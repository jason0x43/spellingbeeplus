/// <reference path="global.d.ts" />

let status = "";

/** @type {Config | undefined} */
let config = undefined;

browser.runtime.onMessage.addListener((request, _sender, sendResponse) => {
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
		status = request.status;
	} else if (request.type === "getStatus") {
		sendResponse(status);
	}

	return true;
});

console.log("Loaded service worker!");
