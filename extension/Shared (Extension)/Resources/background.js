/// <reference path="global.d.ts" />

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
	}

	return true;
});

console.log("Loaded service worker!");
