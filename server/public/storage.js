/**
 * @template T
 * @typedef {import('./sbpTypes').Listener<T>} Listener<T>
 */
/** @typedef {import('./sbpTypes').SbpState} SbpState */
/** @typedef {import('../src/types').PlayerId} PlayerId */
/** @typedef {import('../src/types').NytGameId} NytGameId */
/** @typedef {import('../src/types').GameId} GameId */

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
				id: /** @type {NytGameId} */ (0),
			},
			rank: "Beginner",
			activeView: null,
			player: { id: /** @type {PlayerId} */ (0), name: "" },
			friends: [],
			syncData: {
				friend: { id: /** @type {PlayerId} */ (-1), name: "" },
				nytGameId: /** @type {NytGameId} */ (0),
				gameId: /** @type {GameId} */ (0),
				words: {},
			},
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
			/** @type {Partial<SbpState>} */
			const data = JSON.parse(value);

			if (data.syncData) {
				data.friends = [data.syncData.friend];
			}

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

		const { syncing, status, error, activeView, friends, newName, ...toSave } =
			this.#value;
		localStorage.setItem(this.#key, JSON.stringify(toSave));
	}

	/**
	 * Clear syncData
	 */
	async clearSyncData() {
		this.update({
			syncData: {
				...this.#value.syncData,
				nytGameId: /** @type {NytGameId} */ (0),
				gameId: /** @type {GameId} */ (0),
				words: {},
			},
		});
	}

	// Base properties

	get letter() {
		return this.#value.letter || this.gameData.validLetters[0] || "";
	}

	get gameData() {
		return this.#value.gameData;
	}

	get words() {
		return this.syncData.words;
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

	get syncData() {
		return this.#value.syncData;
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

	// // Derived properties
	//
	// get gameStats() {
	// 	return getWordStats(this.#value.gameData.answers);
	// }
	//
	// get wordStats() {
	// 	return getWordStats(this.#value.words);
	// }
}
