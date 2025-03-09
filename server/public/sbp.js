/** @typedef {import('./sbpTypes').Config} Config */
/** @typedef {import('./sbpTypes').Player} Player */
/** @typedef {import('./sbpTypes').Rank} Rank */
/** @typedef {import('../src/types').NytGameId} NytGameId */
/** @typedef {import('../src/types').PlayerId} PlayerId */
/** @typedef {import('../src/types').GameId} GameId */

import {
	getGameData,
	getHiveActions,
	getNextRank,
	getProgressBar,
	getRank,
	getUserId,
	getWordList,
	getWordListInner,
	getWordListOuter,
	getWordStats,
	getWords,
	hightlightWord,
	sbProgressMarker,
	sbProgressValue,
	updateAnonGame,
	uploadWords,
} from "./sb.js";
import { SbpStore } from "./storage.js";
import * as sync from "./sync.js";
import {
	className,
	def,
	h,
	replace,
	selButton,
	selDiv,
	selElement,
	selInput,
	selSelect,
	sendMessage,
	setClass,
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
const friendSelectId = "sbp-friend-select";
const sbpNameInputId = "sbp-name-input";
const sbpNameInputBoxId = "sbp-name-input-box";
const sbpOtherWordsId = "sbp-other-words";

const state = new SbpStore();

/** @type {ReturnType<typeof setTimeout>} */
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
 * Rebuild the list of words in the "other words" bar.
 *
 * This shows words found by the other player that this player doesn't have yet.
 */
function updateOtherWordsBox() {
	/** @type {Element | null} */
	const box = document.querySelector(`#${sbpOtherWordsId}`);
	if (!box) {
		return;
	}

	if (!state.syncData.gameId) {
		box.innerHTML = "";
		return;
	}

	/** @type {Set<string>} */
	let have;
	try {
		have = new Set(getWords());
	} catch {
		return;
	}

	const otherWords = Object.keys(state.syncData.words)
		.filter((word) => {
			const owner = state.syncData.words[word];
			return (
				owner !== null &&
				owner !== undefined &&
				owner !== state.player.id &&
				!have.has(word)
			);
		})
		.sort();

	box.innerHTML = "";
	for (const word of otherWords) {
		box.append(h("span", {}, word));
	}
}

/**
 * If we have a persisted synced game, load its latest state from the server.
 *
 * @param {Config} config
 */
async function restoreSyncedGame(config) {
	if (!state.syncData.gameId) {
		return;
	}

	try {
		const gameInfo = await sync.getGameInfo(
			{ apiKey: config.apiKey, apiHost: config.apiHost },
			state.syncData.gameId,
		);

		if (gameInfo && gameInfo.nytGameId === state.gameData.id) {
			await state.update({
				syncData: {
					...gameInfo,
					friend: state.syncData.friend,
				},
			});
			log("Restored synced game");
		} else {
			await state.clearSyncData();
			log("Saved synced game doesn't match this puzzle");
		}
	} catch (error) {
		log(`Error restoring synced game: ${error}`);
	} finally {
		updateOtherWordsBox();
	}
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
		if (letter.classList.contains("sbp-letter")) {
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
		h("div", { id: "sbp-sync-view-content" }, [
			h("div", { class: "sbp-form-field" }, [
				h("label", { for: sbpNameInputId }, "Name"),
				h("div", { id: sbpNameInputBoxId }, [
					h("input", {
						id: sbpNameInputId,
						"data-1p-ignore": "true",
					}),
					h("button", { id: "sbp-name-button" }, "💾"),
				]),
			]),
			h("div", { class: "sbp-form-field" }, [
				h("label", { for: friendSelectId }, "Friend"),
				h("select", { id: friendSelectId }),
			]),
			h("button", { id: syncButtonId }, "Sync Words"),
			h("div", { id: "sbp-sync-info" }, [
				h("div", { id: "sbp-sync-status" }),
				h("div", { id: "sbp-sync-log" }),
			]),
		]),
		h("div", { id: "sbp-sync-spinner" }, [h("div", { class: "sbp-spinner" })]),
	]);
	getViewBox().append(view);

	const syncButton = selButton(`#${syncButtonId}`);
	syncButton?.addEventListener("click", async () => {
		// Initiate the sync process -- syncing will be true until we receive
		// confirmation that the other end accepted the sync request.
		state.update({ syncing: true });
		log("Syncing...");
		syncTimeout = setTimeout(() => {
			log("Sync timed out");
			state.update({ syncing: false });
		}, 5000);
		try {
			sync.sendSyncRequest(
				state.syncData.friend.id,
				state.gameData.id,
				getWords(),
			);
		} catch (error) {
			console.error(error);
		}
	});

	const nameInput = selInput(`#${sbpNameInputId}`);
	nameInput?.addEventListener("keydown", (event) => {
		event.stopPropagation();
	});
	nameInput?.addEventListener("input", () => {
		state.update({ newName: nameInput.value });
	});

	const nameButton = selButton("#sbp-name-button");
	nameButton?.addEventListener("click", () => {
		if (state.newName) {
			sync.setName(state.newName);
			state.update({ newName: "" });
		}
	});

	const friendSelect = selSelect(`#${friendSelectId}`);
	friendSelect?.addEventListener("change", () => {
		const friendId = /** @type {PlayerId} */ (Number(friendSelect.value));
		const friend = state.friends.find((f) => f.id === friendId);
		if (friend) {
			state.update({
				syncData: {
					friend,
					nytGameId: /** @type {NytGameId} */ (0),
					gameId: /** @type {GameId} */ (0),
					words: {},
				},
			});
		}
	});
}

/**
 * Update the rendered view(s) based on the gameState
 *
 * @returns {void}
 */
function render() {
	updateOtherWordsBox();

	const view = document.querySelector(`#${sbpViewId}`);
	if (!view) {
		return;
	}

	// firstLetters maps a letter to an array of word lengths. For example,
	// firstLetters.a[4] is the number of 4 letter 'a' words.
	const gameStats = getWordStats(state.gameData.answers);
	const wantLetters = gameStats.firstLetters[state.letter];
	const wordStats = getWordStats();
	const haveLetters = wordStats.firstLetters[state.letter];

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
	const needCounts = counts.map(
		(_, i) => (wantCounts[i] ?? 0) - (haveCounts[i] ?? 0),
	);

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
		(dg) => dg[0] === state.letter,
	);
	const wantDigraphs = digraphs.map((dg) => gameStats.digraphs[dg] ?? 0);
	const haveDigraphs = digraphs.map((dg) => wordStats.digraphs[dg] ?? 0);
	const needDigraphs = digraphs.map(
		(_, i) => (wantDigraphs[i] ?? 0) - (haveDigraphs[i] ?? 0),
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

	if (state.rank === "Genius" || state.rank === "Queen Bee") {
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

		const nextRank = getNextRank();
		if (nextRank) {
			mrkr.style.left = `${nextRank.distance}%`;
			const marker = def(mrkr.querySelector(`.${sbProgressValue}`));
			marker.textContent = `${nextRank.score}`;
			setClass(mrkr, "final", nextRank.distance === 100);
		}
	}

	const summary = def(document.querySelector(".sb-wordlist-summary"));
	if (/You have found/.test(def(summary.textContent))) {
		const words = getWords();
		const found = words.length;
		const total = state.gameData.answers.length;
		const totalPgs = state.gameData.pangrams.length;
		const foundPgs = state.gameData.pangrams.filter((pg) =>
			words.includes(pg),
		).length;
		let summaryText = `You have found ${found} of ${total} words`;
		if (state.rank === "Genius") {
			summaryText += `, ${foundPgs} of ${totalPgs} pangrams`;
		}
		summary.textContent = summaryText;
	}

	getWordListInner().setAttribute("data-sbp-pane", state.activeView ?? "");

	const nameInput = selInput(`#${sbpNameInputId}`);
	if (nameInput) {
		if (state.newName) {
			nameInput.value = state.newName;
		} else {
			nameInput.value = state.player.name;
		}
	}

	const friendSelect = selSelect(`#${friendSelectId}`);
	if (friendSelect) {
		friendSelect.innerHTML = "";
		for (const friend of state.friends) {
			friendSelect.append(h("option", { value: `${friend.id}` }, friend.name));
		}
		friendSelect.value = `${state.syncData.friend.id}`;
	}

	const nameBox = selDiv(`#${sbpNameInputBoxId}`);
	if (state.newName && state.newName !== state.player.name) {
		nameBox?.classList.add("sbp-modified");
	} else {
		nameBox?.classList.remove("sbp-modified");
	}

	const syncButton = selButton(`#${syncButtonId}`);
	if (syncButton) {
		syncButton.disabled = !state.syncData.friend.id || state.syncing;
	}

	// highlight borrowed words
	for (const word in state.syncData.words) {
		const player = state.syncData.words[word];
		if (player && player !== state.player.id) {
			hightlightWord(word);
		}
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
 * Add the bar used to display words added by other players
 */
function addOtherWordsBar() {
	const bar = h("div", { id: sbpOtherWordsId });
	const actions = getHiveActions();
	actions.parentElement?.append(bar);
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
 * @param {string} message
 */
async function log(message) {
	const syncLog = document.querySelector("#sbp-sync-log");
	if (syncLog) {
		syncLog.insertBefore(h("p", message), syncLog.firstElementChild);
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

/**
 * @param {string} host
 */
function injectCss(host) {
	const stylesheet = h("link", {
		href: `https://${host}/sbp.css`,
		rel: "stylesheet",
	});
	document.head.append(stylesheet);
}

/**
 * This should be called when a user has added words to the local game.
 *
 * This function should be run after words have been added to the word list
 * since it needs to see the player's current rank.
 *
 * @param {string} word
 */
async function wordAdded(word) {
	console.log(`Adding word "${word}"`);
	if (state.syncData.gameId && !state.syncData.words[word]) {
		try {
			console.log("Sending word...");
			await sync.sendWord(state.syncData.gameId, word);
		} catch (error) {
			console.warn(`Error adding words: ${error}`);
		}
	}
}

/**
 * @param {PlayerId} id
 */
function isRealPlayerId(id) {
	return id > 0;
}

/**
 * @param {Config} config
 */
export async function main(config) {
	log("Starting SBP...");

	injectCss(config.apiHost);
	setStatus(state.status);

	const gameData = await getGameData();
	if (!getGameData) {
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
		rank: /** @type {Rank} */ (getRank()),
		player: {
			...state.player,
			id: getUserId(),
		},
	});

	addViewBox();
	addButtonBox();
	addSyncView();
	addSyncButton();
	addHintsView();
	addHintsButton();
	addOtherWordsBar();

	await restoreSyncedGame(config);

	// Add a word list observer that will update the app state when the word
	// list is updated.
	const wordList = getWordList();
	const wordsObserver = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			for (const node of Array.from(mutation.addedNodes)) {
				const word = (node.textContent ?? "").trim();
				if (!word) {
					continue;
				}

				wordAdded(word);

				const owner = state.syncData.words[word];
				if (owner && owner !== state.player.id) {
					hightlightWord(word);
				}
			}
		}

		updateOtherWordsBox();
	});
	wordsObserver.observe(wordList, { childList: true });
	console.debug("Installed word list observer");

	installKeyHandler((event) => {
		if (event.key === "ArrowLeft" && event.shiftKey) {
			selectLetterLeft();
		} else if (event.key === "ArrowRight" && event.shiftKey) {
			selectLetterRight();
		}
	});
	console.debug("Installed key handler");

	await state.update({ status: "Connecting" });
	console.debug("Updated state");

	sendMessage(config, { type: "setStatus", status: "OK" });
	console.debug("Updated popup state");

	try {
		console.log("Connecting...");
		await sync.connect(
			{
				apiKey: config.apiKey,
				apiHost: config.apiHost,
			},
			{
				onConnect: async () => {
					console.log(
						`Connected with syncData ID ${state.syncData.nytGameId} and gameId ${state.gameData.id}`,
					);
					await restoreSyncedGame(config);
				},
				onJoin: ({ id, name }) => {
					const friends = state.friends;
					const index = friends.findIndex((f) => f.id === id);
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
				onSync: async (playerId, gameId, words) => {
					log(`Syncing with ${playerId}`);

					// The other end accepted the sync request -- add its words and
					// end the syncing operation.

					clearTimeout(syncTimeout);

					try {
						const borrowedWords = Object.keys(words).filter(
							(word) => !(word in state.words),
						);

						// Add the borrowed words to our game
						if (isRealPlayerId(state.player.id)) {
							await uploadWords(state.gameData.id, borrowedWords);
						} else {
							await updateAnonGame({
								gameId: state.gameData.id,
								words: borrowedWords,
								answers: state.gameData.answers,
								pangrams: state.gameData.pangrams,
							});
						}

						// Update the sync state
						const friend = state.friends.find((f) => f.id === playerId);
						if (friend) {
							await state.update({
								syncData: {
									friend,
									nytGameId: state.gameData.id,
									gameId,
									words,
								},
								syncing: false,
							});
						} else {
							log(`Couldn't find ${playerId} in friends list`);
						}

						// All the received words have been added -- syncing is done
						log("Sync complete");

						// refresh the app
						window.location.reload();
					} catch (error) {
						log(`Error adding words: ${error}`);
					}
				},
				onSyncRequest: (from) => {
					// We received a sync request from another player. If it's
					// accepted, enable the syncing state.
					const friend = state.friends.find((f) => f.id === from);
					if (friend && confirm(`Accept sync request from ${friend.name}?`)) {
						// The request was accepted -- start syncing
						state.update({ syncing: true });
						return {
							words: getWords(),
							gameId: state.gameData.id,
						};
					}
					return false;
				},
				onSyncRejected: () => {
					clearTimeout(syncTimeout);
					log("Sync request rejected");
					state.update({ syncing: false });
				},
				onError: (kind, message) => {
					log(`Error: ${kind} - ${message}`);
					state.update({ error: "Connection errored" });
				},
				onWordAdded: async (word, playerId) => {
					await state.update({
						syncData: {
							...state.syncData,
							words: {
								...state.syncData.words,
								[word]: playerId,
							},
						},
					});
					updateOtherWordsBox();
				},
				getState: () => state,
				findPlayer: (id) => state.friends.find((f) => f.id === id),
				updateState: (newState) => state.update(newState),
				log: (message) => log(message),
			},
		);
	} catch (err) {
		log(`Error connecting: ${err}`);
		await state.update({ error: "Error connecting" });
	}

	console.debug("Started SBP");
}
