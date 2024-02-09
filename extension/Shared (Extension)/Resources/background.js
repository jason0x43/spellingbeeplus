/// <reference path="global.d.ts" />

browser.runtime.onMessage.addListener((request, _sender, sendResponse) => {
	console.log("Received request: ", request);

	if (typeof request !== "object" || !request) {
		return;
	}

	if (request.type === "sync") {
		console.log("syncing...");
		sendResponse({ type: "sync", words: [] });
	}
});

console.log("Loaded service worker");
