/// <reference path="global.d.ts" />

let status = '';

browser.runtime.onMessage.addListener((request, _sender, sendResponse) => {
	if (typeof request !== "object" || !request) {
		return;
	}

	console.log("Handling request:", request);

	if (request.type === "getConfig") {
		browser.runtime.sendNativeMessage(
			"application.id",
			{ type: "getConfig" },
			(response) => {
				sendResponse(response);
			},
		);
	} else if (request.type === "getVersion") {
		browser.runtime.sendNativeMessage(
			"application.id",
			{ type: "getConfig" },
			(response) => {
				sendResponse(response.appVersion);
			},
		);
	} else if (request.type === "setStatus") {
		status = request.status;
	} else if (request.type === "getStatus") {
		sendResponse(status);
	}

	return true;
});

console.log("Loaded service worker!");
