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
	browser.runtime.sendMessage({ type: "getStatus" }).then((status) => {
		setElemText("#status", status);
	});
}

const version = await browser.runtime.sendMessage({
	type: "getVersion",
});

setElemText("#version", version);

setInterval(() => {
	updateStatus();
}, 1000);

updateStatus();
