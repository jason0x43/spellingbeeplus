/// <reference path="./sbpTypes.d.ts" />

// firstLetters maps a letter to an array of word lengths. For example,
// firstLetters.a[4] is the number of 4 letter 'a' words.

import {
	addWord,
	closeCongratsPane,
	getGameData,
	getProgressBar,
	getStats,
	getThresholds,
	getWordList,
	getWordListInner,
	getWordListOuter,
	getWords,
	hightlightWord,
	isCongratsPaneOpen,
	sbProgressMarker,
	sbProgressRank,
	sbProgressValue,
} from "./sb.js";
import { createStore } from "./storage.js";
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

/** @type {Store<SbpState>} */
const sbpState = createStore("sbp-state", {
	letter: "",
	gameData: {
		answers: [],
		centerLetter: "",
		outerLetter: "",
		pangrams: [],
		validLetters: [],
	},
	gameStats: {
		firstLetters: {},
		digraphs: {},
	},
	borrowedWords: [],
	words: [],
	wordStats: {
		firstLetters: {},
		digraphs: {},
	},
	thresholds: {},
	rank: "",
	activeView: null,
	player: { id: "", name: "" },
	friends: [],
	friendId: "",
	newName: "",
	syncing: false,
});

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

	const { gameData } = sbpState.value;
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
		const letter = /** @type HTMLDivElement */ (target);
		updateState({ letter: letter.textContent ?? undefined });
	});

	getViewBox().append(view);
}

/**
 * @returns {void}
 */
function addSyncView() {
	document.querySelector(`#${sbpSyncViewId}`)?.remove();
	const view = h("div", { id: sbpSyncViewId }, [
		h("label", { for: "sbp-name-input" }, "Name"),
		h("div", { id: "sbp-name-input-box" }, [
			h("input", {
				id: "sbp-name-input",
				"data-1p-ignore": "true",
			}),
			h("button", { id: "sbp-name-button" }, "💾"),
		]),
		h("label", { for: "sbp-friend-select" }, "Friend"),
		h("select", { id: "sbp-friend-select" }),
		h("button", { id: syncButtonId }, "Sync Words"),
		h("div", { id: "sbp-sync-spinner" }, [h("div", { class: "sbp-spinner" })]),
	]);
	getViewBox().append(view);

	const syncButton = selButton(`#${syncButtonId}`);
	syncButton?.addEventListener("click", () => {
		// Initiate the sync process -- syncing will be true until we receive
		// confirmation that the other end acceped the sync request.
		updateState({ syncing: true });
		syncTimeout = setTimeout(() => {
			updateState({ syncing: false });
		}, 5000);
		syncWords(sbpState.value.friendId, sbpState.value.words);
	});

	const nameInput = selInput("#sbp-name-input");
	nameInput?.addEventListener("keydown", (event) => {
		event.stopPropagation();
	});
	nameInput?.addEventListener("input", () => {
		updateState({ newName: nameInput.value });
		console.debug(`updated name to ${nameInput.value}`);
	});

	const nameButton = selButton("#sbp-name-button");
	nameButton?.addEventListener("click", () => {
		if (sbpState.value.newName != null) {
			setName(sbpState.value.newName);
			updateState({ newName: null });
		}
	});

	const friendSelect = selSelect("#sbp-friend-select");
	friendSelect?.addEventListener("change", () => {
		updateState({ friendId: friendSelect.value });
	});
}

/**
 * Update the rendered view(s) based on the gameState
 *
 * @param {SbpState} state
 * @returns {void}
 */
function render(state) {
	const view = document.querySelector(`#${sbpViewId}`);
	if (!view) {
		return;
	}

	const {
		activeView,
		gameStats,
		wordStats,
		letter,
		newName,
		friendId,
		friends,
		syncing,
		borrowedWords,
	} = state;

	const wantLetters = gameStats.firstLetters[letter];
	const haveLetters = wordStats.firstLetters[letter];

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

	const digraphs = Object.keys(gameStats.digraphs).filter(
		(dg) => dg[0] === letter,
	);
	const wantDigraphs = digraphs.map((dg) => gameStats.digraphs[dg] ?? 0);
	const haveDigraphs = digraphs.map((dg) => wordStats.digraphs[dg] ?? 0);
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
		setClass(ltr, activeLetterClass, ltrLetter === letter);

		const wantCount =
			gameStats.firstLetters[ltrLetter]?.reduce(
				(sum, count) => sum + count,
				0,
			) ?? 0;
		const haveCount =
			wordStats.firstLetters[ltrLetter]?.reduce(
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

	getWordListInner().setAttribute("data-sbp-pane", activeView ?? "");

	const nameInput = selInput("#sbp-name-input");
	if (nameInput) {
		if (newName != null) {
			nameInput.value = newName;
		} else {
			nameInput.value = sbpState.value.player.name;
		}
	}

	const friendSelect = selSelect("#sbp-friend-select");
	if (friendSelect) {
		friendSelect.innerHTML = "";
		for (const friend of friends) {
			friendSelect.append(h("option", { value: friend.id }, friend.name));
		}
		friendSelect.value = friendId;
	}

	const nameBox = selDiv("#sbp-name-input-box");
	console.debug(
		`comparing new name "${newName}" to player name "${sbpState.value.player.name}"`,
	);
	if (newName && newName !== sbpState.value.player.name) {
		nameBox?.classList.add("sbp-modified");
	} else {
		nameBox?.classList.remove("sbp-modified");
	}

	const syncButton = selButton(`#${syncButtonId}`);
	if (syncButton) {
		syncButton.disabled = !friendId || syncing;
	}

	// highlight borrowed words
	for (const word of borrowedWords) {
		hightlightWord(word);
	}

	const syncView = def(selDiv("#sbp-sync-view"));
	if (syncing) {
		syncView.classList.add("sbp-syncing");
	} else {
		syncView.classList.remove("sbp-syncing");
	}
}

/**
 * @param {Partial<SbpState>} state
 * @returns {Promise<void>}
 */
async function updateState(state) {
	try {
		const newState = { ...sbpState.value, ...state };

		if (state.gameData) {
			newState.gameStats = getStats(state.gameData.answers);
			newState.thresholds = getThresholds(
				state.gameData.answers,
				state.gameData.pangrams,
			);
		}

		if (state.words) {
			newState.wordStats = getStats(state.words);
		}

		if (!newState.letter) {
			newState.letter = newState.gameData.validLetters[0] ?? "";
		}

		// Save the updated game state
		await sbpState.update(newState);
	} catch (error) {
		console.error("Error updating state:", error);
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
		updateState({
			activeView: sbpState.value.activeView === "hints" ? null : "hints",
		});
	});
	document.querySelector(`#${buttonBoxId}`)?.append(button);
}

/**
 * Add the button that opens the sync pane.
 */
function addSyncButton() {
	document.querySelector(`#${syncViewButtonId}`)?.remove();
	console.debug("adding sync button");

	const button = h("button", { id: syncViewButtonId, type: "button" }, "Sync");

	button.addEventListener("click", () => {
		updateState({
			activeView: sbpState.value.activeView === "sync" ? null : "sync",
		});
	});
	document.querySelector(`#${buttonBoxId}`)?.append(button);
}

/**
 * Select the next letter to the left in the hints pane.
 */
function selectLetterLeft() {
	const { gameData, letter } = sbpState.value;
	const index = gameData.validLetters.indexOf(letter);
	if (index > 0) {
		updateState({ letter: gameData.validLetters[index - 1] });
	}
}

/**
 * Select the next letter to the right in the hints pane.
 */
function selectLetterRight() {
	const { gameData, letter } = sbpState.value;
	const index = gameData.validLetters.indexOf(letter);
	if (index < gameData.validLetters.length - 1) {
		updateState({ letter: gameData.validLetters[index + 1] });
	}
}

/**
 * @param {string[]} words
 */
export async function addWords(words) {
	for (const word of words) {
		if (isCongratsPaneOpen()) {
			await wait(500);
			closeCongratsPane();
			await wait(500);
		}

		await addWord(word);
		await wait(100);
	}
}

async function main() {
	console.debug("Starting SBP...");

	const config = await browser.runtime.sendMessage({
		type: "getConfig",
	});

	if (!config) {
		console.warn("No config found, aborting startup");
		return;
	}

	await sbpState.load();
	sbpState.subscribe(render);

	const rank = def(document.querySelector(`.${sbProgressRank}`));

	updateState({
		gameData: await getGameData(),
		words: getWords(),
		rank: getNormalizedText(rank) ?? "beginner",
	});

	addViewBox();
	addButtonBox();
	addSyncView();
	addSyncButton();
	addHintsView();
	addHintsButton();

	const wordList = getWordList();
	const wordsObserver = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			const addedWords = Array.from(mutation.addedNodes).map((node) =>
				(node.textContent ?? "").trim(),
			);
			updateState({ words: [...sbpState.value.words, ...addedWords] });
		}
	});
	wordsObserver.observe(wordList, { childList: true });

	const rankObserver = new MutationObserver(() => {
		updateState({ rank: getNormalizedText(rank) });
	});
	rankObserver.observe(rank, {
		subtree: true,
		characterData: true,
	});

	installKeyHandler((event) => {
		if (event.key === "ArrowLeft" && event.shiftKey) {
			selectLetterLeft();
		} else if (event.key === "ArrowRight" && event.shiftKey) {
			selectLetterRight();
		}
	});
	console.debug("Installed key handler");

	await connect(
		{
			apiKey: config.apiKey,
			apiHost: config.apiHost ?? "sbp.jason0x43.dev",
		},
		{
			onJoin: ({ id, name }) => {
				console.debug("got join event");
				const friends = sbpState.value.friends;
				let index = friends.findIndex((f) => f.id === id);
				if (index !== -1) {
					updateState({
						friends: [
							...friends.slice(0, index),
							{ id, name },
							...friends.slice(index + 1),
						],
					});
				} else {
					updateState({ friends: [...friends, { id, name }] });
				}
			},
			onLeave: (id) => {
				console.debug("got leave event");
				const friends = sbpState.value.friends;
				const index = friends.findIndex((f) => f.id === id);
				if (index !== -1) {
					updateState({
						friends: [...friends.slice(0, index), ...friends.slice(index + 1)],
					});
				}
			},
			onSync: (words) => {
				// The other end accepted the sync request -- add its words and
				// end the syncing state
				clearTimeout(syncTimeout);
				const borrowedWords = words.filter(
					(word) => !sbpState.value.words.includes(word),
				);
				updateState({ borrowedWords });
				addWords(sbpState.value.borrowedWords).finally(() => {
					// All the received words have been added -- syncing is done
					updateState({ syncing: false });
				});
			},
			onSyncRequest: (from) => {
				// We received a sync request from another player. If it's
				// accepted, enable the syncing state.
				const friend = sbpState.value.friends.find((f) => f.id === from);
				if (friend && confirm(`Accept sync request from ${friend.name}?`)) {
					// The request was accepted -- start syncing
					updateState({ syncing: true });
					return sbpState.value.words;
				}
				return false;
			},
			onSyncRefused: () => {
				clearTimeout(syncTimeout);
				updateState({ syncing: false });
			},
			onError: () => {
				console.debug("error");
			},
			getState: () => sbpState.value,
			updateState: (newState) => updateState(newState),
		},
	);

	console.debug("Started SBP");
}

try {
	await main();
} catch (error) {
	console.error("Error running main:", error);
}
