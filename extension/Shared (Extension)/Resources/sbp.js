/// <reference path="./sbpTypes.d.ts" />

// firstLetters maps a letter to an array of word lengths. For example,
// firstLetters.a[4] is the number of 4 letter 'a' words.

import config from "./config.js";
import {
	addWord,
	closeCongratsPane,
	getGameData,
	getProgressBar,
	getWordList,
	getWordListInner,
	getWordListOuter,
	getWords,
	hightlightWord,
	isCongratsPaneOpen,
	sbProgressMarker,
	sbProgressValue,
	getRank,
	clearWord,
} from "./sb.js";
import { SbpStore } from "./storage.js";
import { connect, setName, syncWords } from "./sync.js";
import {
	className,
	def,
	getNormalizedText,
	h,
	replace,
	selButton,
	selDiv,
	selElement,
	selInput,
	selSelect,
	setClass,
	wait,
} from "./util.js";

const activeLetterClass = "sbp-letter-active";
const baseClass = "sbp";
const cellClass = "sbp-table-cell";
const completeClass = "sbp-complete";
const digraphClass = "sbp-digraph";
const hintsClass = "sbp-hints";
const leftLabelClass = "sbp-left-label";
const letterClass = "sbp-letter";
const lettersClass = "sbp-letters";
const progressMarkerClass = "sbp-progress-marker";
const rowClass = "sbp-table-row";
const tableClass = "sbp-table";

const buttonBoxId = "sbp-button-box";
const countTableId = "sbp-count-table";
const digraphTableId = "sbp-digraph-table";
const sbpSyncViewId = "sbp-sync-view";
const sbpViewId = "sbp-hints-view";
const viewBoxId = "sbp-view-box";
const syncViewButtonId = "sbp-sync-view-button";
const syncButtonId = "sbp-sync-button";

const state = new SbpStore();

/** @type {number | undefined} */
let syncTimeout;

/**
 * Install a listener for keyboard shortcuts
 *
 * @param {(data: { key: string, shiftKey: boolean }) => void} onKeydown
 * @returns {void}
 */
function installKeyHandler(onKeydown) {
	const script = h(
		"script",
		`window.addEventListener('keydown', (event) => {
			postMessage({ keydown: { key: event.key, shiftKey: event.shiftKey }})
		});`,
	);
	script.setAttribute("data-id", "sbp-key-handler");

	window.addEventListener("message", (event) => {
		if (event.data?.keydown) {
			onKeydown(event.data.keydown);
		}
	});

	console.debug("injecting script");
	document.body.append(script);
}

/**
 * Return the view container.
 *
 * @returns {Element}
 */
function getViewBox() {
	return def(document.querySelector(`#${viewBoxId}`));
}

/**
 * @returns {void}
 */
function addHintsView() {
	document.querySelector(`#${sbpViewId}`)?.remove();

	const gameData = state.gameData;
	const view = h("div", { id: sbpViewId });

	const letters = h("div", { class: lettersClass }, [
		...gameData.validLetters.map((letter) =>
			h("div", { class: "sbp-letter" }, letter),
		),
	]);
	view.append(letters);

	view.append(h("div", { id: countTableId }));
	view.append(h("div", { id: digraphTableId }));

	letters.addEventListener("click", ({ target }) => {
		const letter = /** @type HTMLElement */ (target);
		if (letter.classList.contains('sbp-letter')) {
			state.update({ letter: letter.textContent ?? undefined });
		}
	});

	getViewBox().append(view);
}

/**
 * @returns {void}
 */
function addSyncView() {
	document.querySelector(`#${sbpSyncViewId}`)?.remove();
	const view = h("div", { id: sbpSyncViewId }, [
		h("div", { class: "sbp-form-field" }, [
			h("label", { for: "sbp-name-input" }, "Name"),
			h("div", { id: "sbp-name-input-box" }, [
				h("input", {
					id: "sbp-name-input",
					"data-1p-ignore": "true",
				}),
				h("button", { id: "sbp-name-button" }, "💾"),
			]),
		]),
		h("div", { class: "sbp-form-field" }, [
			h("label", { for: "sbp-friend-select" }, "Friend"),
			h("select", { id: "sbp-friend-select" }),
		]),
		h("button", { id: syncButtonId }, "Sync Words"),
		h("div", { id: "sbp-sync-spinner" }, [h("div", { class: "sbp-spinner" })]),
		h("div", { id: "sbp-sync-info" }, [
			h("div", { id: "sbp-sync-status" }),
			h("div", { id: "sbp-sync-log" }),
		]),
	]);
	getViewBox().append(view);

	const syncButton = selButton(`#${syncButtonId}`);
	syncButton?.addEventListener("click", () => {
		// Initiate the sync process -- syncing will be true until we receive
		// confirmation that the other end acceped the sync request.
		state.update({ syncing: true });
		log("Syncing...");
		syncTimeout = setTimeout(() => {
			log("Sync timed out");
			state.update({ syncing: false });
		}, 5000);
		syncWords(state.friendId, state.words);
	});

	const nameInput = selInput("#sbp-name-input");
	nameInput?.addEventListener("keydown", (event) => {
		event.stopPropagation();
	});
	nameInput?.addEventListener("input", () => {
		state.update({ newName: nameInput.value });
		console.debug(`updated name to ${nameInput.value}`);
	});

	const nameButton = selButton("#sbp-name-button");
	nameButton?.addEventListener("click", () => {
		if (state.newName) {
			setName(state.newName);
			state.update({ newName: "" });
		}
	});

	const friendSelect = selSelect("#sbp-friend-select");
	friendSelect?.addEventListener("change", () => {
		state.update({ friendId: friendSelect.value });
	});
}

/**
 * Update the rendered view(s) based on the gameState
 *
 * @returns {void}
 */
function render() {
	const view = document.querySelector(`#${sbpViewId}`);
	if (!view) {
		return;
	}

	const wantLetters = state.gameStats.firstLetters[state.letter];
	const haveLetters = state.wordStats.firstLetters[state.letter];

	/** @type {number[]} */
	const counts = [];
	if (wantLetters) {
		for (let i = 0; i < wantLetters.length; i++) {
			if (wantLetters[i]) {
				counts.push(i);
			}
		}
	}

	const wantCounts = counts.map((count) => wantLetters?.[count] ?? 0);
	const haveCounts = counts.map((count) => haveLetters?.[count] ?? 0);
	const needCounts = counts.map((_, i) => wantCounts[i] - haveCounts[i]);

	const countTable = h("div", { id: countTableId, class: tableClass }, [
		h("div", { class: rowClass }, [
			h("div", { class: className(leftLabelClass, cellClass) }, "Length"),
			...counts.map((count, i) => {
				return h(
					"div",
					{
						class: className(cellClass, {
							[completeClass]: needCounts[i] === 0,
						}),
					},
					`${count}`,
				);
			}),
		]),
		h("div", { class: rowClass }, [
			h("div", { class: className(leftLabelClass, cellClass) }, "Need"),
			...counts.map((_, i) => {
				return h(
					"div",
					{
						class: className(cellClass, {
							[completeClass]: needCounts[i] === 0,
						}),
					},
					`${needCounts[i]}`,
				);
			}),
		]),
	]);

	replace(countTableId, view, countTable);

	const digraphs = Object.keys(state.gameStats.digraphs).filter(
		(dg) => dg[0] === state.letter,
	);
	const wantDigraphs = digraphs.map((dg) => state.gameStats.digraphs[dg] ?? 0);
	const haveDigraphs = digraphs.map((dg) => state.wordStats.digraphs[dg] ?? 0);
	const needDigraphs = digraphs.map(
		(_, i) => wantDigraphs[i] - haveDigraphs[i],
	);

	const digraphTable = h("div", { id: digraphTableId, class: tableClass }, [
		h("div", { class: rowClass }, [
			h("div", { class: className(leftLabelClass, cellClass) }, "Digraph"),
			...digraphs.map((digraph, i) => {
				return h(
					"div",
					{
						class: className(cellClass, digraphClass, {
							[completeClass]: needDigraphs[i] === 0,
						}),
					},
					digraph,
				);
			}),
		]),
		h("div", { class: rowClass }, [
			h("th", { class: className(leftLabelClass, cellClass) }, "Need"),
			...digraphs.map((_, i) => {
				return h(
					"div",
					{
						class: className(cellClass, {
							[completeClass]: needDigraphs[i] === 0,
						}),
					},
					`${needDigraphs[i]}`,
				);
			}),
		]),
	]);

	replace(digraphTableId, view, digraphTable);

	view.querySelectorAll(`.${lettersClass} .${letterClass}`).forEach((ltr) => {
		const ltrLetter = def(ltr.textContent);
		setClass(ltr, activeLetterClass, ltrLetter === state.letter);

		const wantCount =
			state.gameStats.firstLetters[ltrLetter]?.reduce(
				(sum, count) => sum + count,
				0,
			) ?? 0;
		const haveCount =
			state.wordStats.firstLetters[ltrLetter]?.reduce(
				(sum, count) => sum + count,
				0,
			) ?? 0;
		setClass(ltr, completeClass, wantCount === haveCount);
	});

	const progressBar = getProgressBar();
	const nextMarker = selElement(`.${progressMarkerClass}`);

	if (state.rank === "genius") {
		const wordListBox = getWordListOuter();
		if (wordListBox && !wordListBox.classList.contains(baseClass)) {
			wordListBox.classList.add(baseClass);
		}

		// If we hit genius, hide the next rank marker
		if (nextMarker) {
			nextMarker.remove();
		}
	} else {
		/** @type {HTMLElement | null} */
		let mrkr;

		if (nextMarker) {
			mrkr = nextMarker;
		} else {
			mrkr = h(
				"div",
				{
					class: `${sbProgressMarker} ${progressMarkerClass}`,
				},
				h("span", { class: sbProgressValue }),
			);
			progressBar.append(mrkr);
		}
		const nextRank = state.thresholds[state.rank];
		if (nextRank) {
			mrkr.style.left = `${nextRank.distance}%`;
			const marker = def(mrkr.querySelector(`.${sbProgressValue}`));
			marker.textContent = `${nextRank.score}`;
			setClass(mrkr, "final", nextRank.distance === 100);
		}
	}

	const summary = def(document.querySelector(".sb-wordlist-summary"));
	if (/You have found/.test(def(summary.textContent))) {
		const found = state.words.length;
		const total = state.gameData.answers.length;
		const totalPgs = state.gameData.pangrams.length;
		const foundPgs = state.gameData.pangrams.filter((pg) =>
			state.words.includes(pg),
		).length;
		let summaryText = `You have found ${found} of ${total} words`;
		if (state.rank === "genius") {
			summaryText += `, ${foundPgs} of ${totalPgs} pangrams`;
		}
		summary.textContent = summaryText;
	}

	getWordListInner().setAttribute("data-sbp-pane", state.activeView ?? "");

	const nameInput = selInput("#sbp-name-input");
	if (nameInput) {
		if (state.newName) {
			nameInput.value = state.newName;
		} else {
			nameInput.value = state.player.name;
		}
	}

	const friendSelect = selSelect("#sbp-friend-select");
	if (friendSelect) {
		friendSelect.innerHTML = "";
		for (const friend of state.friends) {
			friendSelect.append(h("option", { value: friend.id }, friend.name));
		}
		friendSelect.value = state.friendId;
	}

	const nameBox = selDiv("#sbp-name-input-box");
	if (state.newName && state.newName !== state.player.name) {
		nameBox?.classList.add("sbp-modified");
	} else {
		nameBox?.classList.remove("sbp-modified");
	}

	const syncButton = selButton(`#${syncButtonId}`);
	if (syncButton) {
		syncButton.disabled = !state.friendId || state.syncing;
	}

	// highlight borrowed words
	for (const word of state.borrowedWords) {
		hightlightWord(word);
	}

	const syncView = def(selDiv("#sbp-sync-view"));
	if (state.syncing) {
		syncView.classList.add("sbp-syncing");
	} else {
		syncView.classList.remove("sbp-syncing");
	}
}

/**
 * Add the container for the SBP views.
 */
function addViewBox() {
	document.querySelector(`#${viewBoxId}`)?.remove();
	const box = h("div", { id: viewBoxId });
	getWordListInner().append(box);
}

/**
 * Add a container for the sync and hints buttons.
 */
function addButtonBox() {
	document.querySelector(`#${buttonBoxId}`)?.remove();
	const box = h("div", { id: buttonBoxId });
	getWordListInner().append(box);
}

/**
 * Add the button that opens the hints pane.
 */
function addHintsButton() {
	document.querySelector(`#${hintsClass}-button`)?.remove();

	const button = h(
		"button",
		{ id: `${hintsClass}-button`, type: "button" },
		"Hints",
	);

	button.addEventListener("click", () => {
		state.update({
			activeView: state.activeView === "hints" ? null : "hints",
		});
	});
	document.querySelector(`#${buttonBoxId}`)?.append(button);
}

/**
 * Add the button that opens the sync pane.
 */
function addSyncButton() {
	document.querySelector(`#${syncViewButtonId}`)?.remove();

	const button = h("button", { id: syncViewButtonId, type: "button" }, "Sync");

	button.addEventListener("click", () => {
		state.update({
			activeView: state.activeView === "sync" ? null : "sync",
		});
	});
	document.querySelector(`#${buttonBoxId}`)?.append(button);
}

/**
 * Select the next letter to the left in the hints pane.
 */
function selectLetterLeft() {
	const { gameData, letter } = state;
	const index = gameData.validLetters.indexOf(letter);
	if (index > 0) {
		state.update({ letter: gameData.validLetters[index - 1] });
	}
}

/**
 * Select the next letter to the right in the hints pane.
 */
function selectLetterRight() {
	const { gameData, letter } = state;
	const index = gameData.validLetters.indexOf(letter);
	if (index < gameData.validLetters.length - 1) {
		state.update({ letter: gameData.validLetters[index + 1] });
	}
}

/**
 * @param {string[]} words
 */
export async function addWords(words) {
	const toAdd = words.slice();
	let adding = false;

	while (toAdd.length > 0) {
		if (isCongratsPaneOpen()) {
			await wait(250);

			closeCongratsPane();

			while (isCongratsPaneOpen()) {
				await wait(100);
			}

			await wait(250);
		}

		if (adding) {
			// the last add didn't succeed; clear the entry area and try again
			clearWord();
			await wait(250);
		}

		try {
			adding = true;
			await addWord(toAdd[0]);
			await wait(250);
			toAdd.shift();
			adding = false;
		} catch (error) {}
	}
}

/**
 * @param {string} message
 */
async function log(message) {
	const syncLog = document.querySelector("#sbp-sync-log");
	if (syncLog) {
		syncLog.append(h("p", message));
	}
}

/**
 * @param {string} status
 */
async function setStatus(status) {
	const syncStatus = document.querySelector("#sbp-sync-status");
	if (syncStatus) {
		syncStatus.textContent = status;
	}
}

async function main() {
	console.debug("Starting SBP...");
	log("Starting SBP...");

	setStatus(state.status);

	const gameData = await getGameData();
	if (!getGameData) {
		console.warn("Could not load game data -- aborting!");
		log("Could not load game data -- aborting!");
		return;
	}

	await state.load();
	state.subscribe(render);

	state.subscribe(() => {
		if (state.error) {
			setStatus(state.error);
		} else if (state.syncing) {
			setStatus("Syncing...");
		} else {
			setStatus(state.status);
		}
	});

	await state.update({
		gameData,
		words: getWords(),
		rank: /** @type {Rank} */ (getNormalizedText(getRank())),
	});

	addViewBox();
	addButtonBox();
	addSyncView();
	addSyncButton();
	addHintsView();
	addHintsButton();

	// Add a word list observer that will update the app state when the word
	// list is updated.
	const wordList = getWordList();
	const wordsObserver = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			const addedWords = Array.from(mutation.addedNodes).map((node) =>
				(node.textContent ?? "").trim(),
			);
			state.update({ words: [...state.words, ...addedWords] });
		}
	});
	wordsObserver.observe(wordList, { childList: true });
	console.debug("Installed word list observer");

	// Add a rank observer that will update the app state when the player's
	// rank changes.
	const rank = getRank();
	const rankObserver = new MutationObserver(() => {
		state.update({
			rank: /** @type {Rank} */ (getNormalizedText(getRank())),
		});
	});
	rankObserver.observe(rank, {
		subtree: true,
		characterData: true,
	});
	console.debug("Installed rank observer");

	installKeyHandler((event) => {
		if (event.key === "ArrowLeft" && event.shiftKey) {
			selectLetterLeft();
		} else if (event.key === "ArrowRight" && event.shiftKey) {
			selectLetterRight();
		}
	});
	console.debug("Installed key handler");

	console.debug("Connecting with config", config);

	log(`Connecting to ${config.apiHost}...`);
	await state.update({ status: "Connecting" });

	try {
		await connect(
			{
				apiKey: config.apiKey,
				apiHost: config.apiHost,
			},
			{
				onJoin: ({ id, name }) => {
					console.debug("got join event");
					const friends = state.friends;
					let index = friends.findIndex((f) => f.id === id);
					if (index !== -1) {
						state.update({
							friends: [
								...friends.slice(0, index),
								{ id, name },
								...friends.slice(index + 1),
							],
						});
					} else {
						state.update({ friends: [...friends, { id, name }] });
					}
				},
				onLeave: (id) => {
					console.debug("got leave event");
					const friends = state.friends;
					const index = friends.findIndex((f) => f.id === id);
					if (index !== -1) {
						state.update({
							friends: [
								...friends.slice(0, index),
								...friends.slice(index + 1),
							],
						});
					}
				},
				onSync: (words) => {
					// The other end accepted the sync request -- add its words and
					// end the syncing state
					clearTimeout(syncTimeout);
					const borrowedWords = words.filter(
						(word) => !state.words.includes(word),
					);
					state.update({ borrowedWords });
					addWords(state.borrowedWords).finally(() => {
						// All the received words have been added -- syncing is done
						state.update({ syncing: false });
					});
				},
				onSyncRequest: (from) => {
					// We received a sync request from another player. If it's
					// accepted, enable the syncing state.
					const friend = state.friends.find((f) => f.id === from);
					if (friend && confirm(`Accept sync request from ${friend.name}?`)) {
						// The request was accepted -- start syncing
						state.update({ syncing: true });
						return state.words;
					}
					return false;
				},
				onSyncRefused: () => {
					clearTimeout(syncTimeout);
					state.update({ syncing: false });
				},
				onError: () => {
					console.debug("error");
					state.update({ error: "Connection errored" });
				},
				getState: () => state,
				updateState: (newState) => state.update(newState),
			},
		);

		await state.update({ status: "Connected" });
		log("Connected");
	} catch (err) {
		console.warn(`Error connecting: ${err}`);
		await state.update({ error: "Error connecting" });
	}

	console.debug("Started SBP");
}

try {
	await main();
} catch (error) {
	console.error("Error running main:", error);
}
