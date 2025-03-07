/**
 * @template T
 * @typedef {import('./sbpTypes').Listener<T>} Listener<T>
 */
/** @typedef {import('./sbpTypes').SbpState} SbpState */
/** @typedef {import('../src/message').ClientId} ClientId */

import { getWordStats } from "./sb.js";

export class SbpStore {
	/** @type {Set<Listener<SbpState>>} */
	#listeners = new Set();

	/** @type {string} */
	#key;

	/** @type {SbpState} */
	#value;

	constructor() {
		this.#key = "sbp-state";
		this.#value = {
			letter: "",
			gameData: {
				answers: [],
				centerLetter: "",
				outerLetter: "",
				pangrams: [],
				validLetters: [],
				id: -1,
			},
			borrowedWords: [],
			words: [],
			rank: "beginner",
			activeView: null,
			player: { id: /** @type {ClientId} */ (""), name: "" },
			friends: [],
			friendId: /** @type {ClientId} */ (""),
			newName: "",
			syncing: false,
			status: "Starting",
			error: undefined,
		};
	}

	/**
	 * Internal update method
	 *
	 * @param {Partial<SbpState>} newVal
	 */
	async #updateValue(newVal) {
		const oldVal = this.#value;
		this.#value = {
			...oldVal,
			...newVal,
		};

		for (const listener of this.#listeners) {
			listener(this.#value, oldVal);
		}
	}

	/**
	 * @param {Listener<SbpState>} listener
	 */
	subscribe(listener) {
		this.#listeners.add(listener);
	}

	/**
	 * Load this store's value from persistent storage.
	 *
	 * @returns {Promise<void>}
	 */
	async load() {
		const value = localStorage.getItem(this.#key);
		if (value) {
			/** @type {{ [key: string]: Partial<SbpState> }} */
			const data = JSON.parse(value);

			// clear any values that shouldn't have been saved
			delete data.syncing;
			delete data.status;
			delete data.error;
			delete data.activeView;
			delete data.friends;
			delete data.friendId;
			delete data.newName;

			this.#updateValue(data);
		}
	}

	/**
	 * Update the store and save its value to persistent storage.
	 *
	 * @param {Partial<SbpState>} newVal
	 */
	async update(newVal) {
		if (newVal.gameData) {
			newVal = {
				...newVal,
				gameData: {
					...newVal.gameData,
					validLetters: newVal.gameData.validLetters.slice().sort(),
				},
			};
		}

		this.#updateValue(newVal);

		const {
			syncing,
			status,
			error,
			activeView,
			friends,
			friendId,
			newName,
			...toSave
		} = this.#value;
		localStorage.setItem(this.#key, JSON.stringify(toSave));
	}

	// Base properties

	get letter() {
		return this.#value.letter || this.gameData.validLetters[0] || "";
	}

	get gameData() {
		return this.#value.gameData;
	}

	get borrowedWords() {
		return this.#value.borrowedWords;
	}

	get words() {
		return this.#value.words;
	}

	get rank() {
		return this.#value.rank || "beginner";
	}

	get activeView() {
		return this.#value.activeView;
	}

	get player() {
		return this.#value.player;
	}

	get friends() {
		return this.#value.friends;
	}

	get friendId() {
		return this.#value.friendId;
	}

	get newName() {
		return this.#value.newName;
	}

	get syncing() {
		return this.#value.syncing;
	}

	get status() {
		return this.#value.status;
	}

	get error() {
		return this.#value.error;
	}

	// Derived properties

	get gameStats() {
		return getWordStats(this.#value.gameData.answers);
	}

	get wordStats() {
		return getWordStats(this.#value.words);
	}
}
