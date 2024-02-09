/// <reference path="./sbpTypes.d.ts" />

// firstLetters maps a letter to an array of word lengths. For example,
// firstLetters.a[4] is the number of 4 letter 'a' words.

import {
	getDrawer,
	getProgressBar,
	getWordList,
	getWordListInner,
	getWordListOuter,
	getWords,
	sbProgressMarker,
	sbProgressRank,
	sbProgressValue,
} from "./sb.js";
import { connect } from "./sync.js";
import {
	className,
	def,
	getNormalizedText,
	h,
	replace,
	setClass,
} from "./util.js";

const baseClass = "sbp";
const viewBoxId = "sbp-view-box";
const buttonBoxId = "sbp-button-box";
const hintsClass = "sbp-hints";
const syncClass = "sbp-sync";
const sbpViewId = "sbp-hints-view";
const sbpSyncViewId = "sbp-sync-view";
const countTableId = "sbp-count-table";
const leftLabelClass = "sbp-left-label";
const digraphTableId = "sbp-digraph-table";
const digraphClass = "sbp-digraph";
const tableClass = "sbp-table";
const rowClass = "sbp-table-row";
const cellClass = "sbp-table-cell";
const lettersClass = "sbp-letters";
const letterClass = "sbp-letter";
const activeLetterClass = "sbp-letter-active";
const completeClass = "sbp-complete";
const progressMarkerClass = "sbp-progress-marker";

/** @type {GameState} */
let gameState = {
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
	words: [],
	wordStats: {
		firstLetters: {},
		digraphs: {},
	},
	thresholds: {},
	rank: "",
	activeView: null,
};

/**
 * Get the game data.
 */
async function getGameData() {
	/** @type {Promise<GameData>} */
	return new Promise((resolve) => {
		const script = h(
			"script",
			"postMessage({ gameData: window.gameData.today })",
		);

		/** @type {(event: MessageEvent) => void} */
		const listener = (event) => {
			if (event.data?.gameData) {
				console.log("got message with game data");
				window.removeEventListener("message", listener);
				resolve(event.data.gameData);
			}
		}

		window.addEventListener("message", listener);

		console.log("injecting script");
		document.body.append(script);
	});
}

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

	console.log("injecting script");
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
 * @param {string[]} words
 */
function getStats(words) {
	/** @type {Record<string, number[]>} */
	const firstLetters = {};
	/** @type {Record<string, number>} */
	const digraphs = {};

	for (const word of words) {
		const firstLetter = word[0];
		firstLetters[firstLetter] ??= [];
		firstLetters[firstLetter][word.length] ??= 0;
		firstLetters[firstLetter][word.length]++;

		const digraph = word.slice(0, 2);
		digraphs[digraph] ??= 0;
		digraphs[digraph]++;
	}

	return { firstLetters, digraphs };
}

/**
 * @param {string[]} words
 * @param {string[]} pangrams
 */
function getThresholds(words, pangrams) {
	const maxScore = words.reduce((score, word) => {
		score += word.length === 4 ? 1 : word.length;
		if (pangrams.includes(word)) {
			score += 7;
		}
		return score;
	}, 0);
	const delta = 100 / 8;

	console.log("max score:", maxScore);

	return {
		beginner: {
			score: Math.round((2 / 100) * maxScore),
			distance: delta,
		},
		"good start": {
			score: Math.round((5 / 100) * maxScore),
			distance: delta * 2,
		},
		"moving up": {
			score: Math.round((8 / 100) * maxScore),
			distance: delta * 3,
		},
		good: {
			score: Math.round((15 / 100) * maxScore),
			distance: delta * 4,
		},
		solid: {
			score: Math.round((25 / 100) * maxScore),
			distance: delta * 5,
		},
		nice: {
			score: Math.round((48 / 100) * maxScore),
			distance: delta * 6,
		},
		great: {
			score: Math.round((50 / 100) * maxScore),
			distance: delta * 7,
		},
		amazing: {
			score: Math.round((70 / 100) * maxScore),
			distance: delta * 8,
		},
	};
}

/**
 * @returns {void}
 */
function addHintsView() {
	document.querySelector(`#${sbpViewId}`)?.remove();

	const { gameData } = gameState;
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
	const view = h("div", { id: sbpSyncViewId });
	view.append(h("h2", "Sync me!"));
	getViewBox().append(view);
}

/** @param {Partial<GameState>} state */
function updateState(state) {
	gameState = { ...gameState, ...state };

	if (state.gameData) {
		gameState.gameStats = getStats(state.gameData.answers);
		gameState.thresholds = getThresholds(
			state.gameData.answers,
			state.gameData.pangrams,
		);
	}

	if (state.words) {
		gameState.wordStats = getStats(state.words);
	}

	if (!gameState.letter) {
		gameState.letter = gameState.gameData.validLetters[0] ?? "";
	}

	const progressBar = getProgressBar();
	const nextMarker = document.querySelector(`.${progressMarkerClass}`);

	if (gameState.rank === "genius") {
		const wordListBox = getWordListOuter();
		if (wordListBox && !wordListBox.classList.contains(baseClass)) {
			wordListBox.classList.add(baseClass);
		}

		// If we hit genius, hide the next rank marker
		if (nextMarker) {
			nextMarker.remove();
		}
	} else {
		let mrkr;
		if (nextMarker) {
			mrkr = /** @type {HTMLElement} */ (nextMarker);
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
		const nextRank = gameState.thresholds[gameState.rank];
		if (nextRank) {
			mrkr.style.left = `${nextRank.distance}%`;
			const marker = def(mrkr.querySelector(`.${sbProgressValue}`));
			marker.textContent = `${nextRank.score}`;
			setClass(mrkr, "final", nextRank.distance === 100);
		}
	}

	const summary = def(document.querySelector(".sb-wordlist-summary"));
	if (/You have found/.test(def(summary.textContent))) {
		const found = gameState.words.length;
		const total = gameState.gameData.answers.length;
		const totalPgs = gameState.gameData.pangrams.length;
		const foundPgs = gameState.gameData.pangrams.filter((pg) =>
			gameState.words.includes(pg),
		).length;
		let summaryText = `You have found ${found} of ${total} words`;
		if (gameState.rank === "genius") {
			summaryText += `, ${foundPgs} of ${totalPgs} pangrams`;
		}
		summary.textContent = summaryText;
	}

	const view = document.querySelector(`#${sbpViewId}`);
	if (!view) {
		// Don't try to update the UI if we haven't created the hints view
		return;
	}

	const { activeView: visiblePane, gameStats, wordStats, letter } = gameState;

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

	getDrawer().setAttribute("data-sbp-pane", visiblePane ?? "");
}

function addViewBox() {
	document.querySelector(`#${viewBoxId}`)?.remove();
	const box = h("div", { id: viewBoxId });
	getWordListInner().append(box);
}

function addButtonBox() {
	document.querySelector(`#${buttonBoxId}`)?.remove();
	const box = h("div", { id: buttonBoxId });
	getWordListInner().append(box);
}

function addHintsButton() {
	document.querySelector(`#${hintsClass}-button`)?.remove();

	const button = h(
		"button",
		{ id: `${hintsClass}-button`, type: "button" },
		"Hints",
	);

	button.addEventListener("click", toggleHints);
	document.querySelector(`#${buttonBoxId}`)?.append(button);
}

function addSyncButton() {
	document.querySelector(`#${syncClass}-button`)?.remove();
	console.log("adding sync button");

	const button = h(
		"button",
		{ id: `${syncClass}-button`, type: "button" },
		"Sync",
	);

	button.addEventListener("click", toggleSync);
	document.querySelector(`#${buttonBoxId}`)?.append(button);
}

function toggleHints() {
	const newState = gameState.activeView === "hints" ? null : "hints";
	updateState({ activeView: newState });
}

function toggleSync() {
	const newState = gameState.activeView === "sync" ? null : "sync";
	updateState({ activeView: newState });
}

function selectLetterLeft() {
	const index = gameState.gameData.validLetters.indexOf(gameState.letter);
	if (index > 0) {
		updateState({ letter: gameState.gameData.validLetters[index - 1] });
	}
}

function selectLetterRight() {
	const index = gameState.gameData.validLetters.indexOf(gameState.letter);
	if (index < gameState.gameData.validLetters.length - 1) {
		updateState({ letter: gameState.gameData.validLetters[index + 1] });
	}
}

async function main() {
	console.log("Starting SBP...");

	const rank = def(document.querySelector(`.${sbProgressRank}`));

	updateState({
		gameData: await getGameData(),
		words: getWords(),
		rank: getNormalizedText(rank),
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
			updateState({ words: [...gameState.words, ...addedWords] });
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
		if (event.key === 'ArrowLeft' && event.shiftKey) {
			selectLetterLeft();
		} else if (event.key === 'ArrowRight' && event.shiftKey) {
			selectLetterRight();
		}
	});
	console.log("Installed key handler");

	try {
		await connect();
	} catch (error) {
		console.error(`Error connecting: ${error}`);
	}

	console.log("Started SBP");
}

try {
	await main();
} catch (error) {
	console.error("Error running main:", error);
}

export {};
