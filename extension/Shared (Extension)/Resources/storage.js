import { getWordStats, getThresholds } from "./sb.js";

export class SbpStore {
	/** @type {Set<Listener<SbpState>>} */
	#listeners = new Set();

	/** @type {string} */
	#key;

	/** @type {SbpState} */
	#value;

	/**
	 * @param {SbpState} initialValue
	 */
	constructor(initialValue) {
		this.#key = "sbp-state";
		this.#value = initialValue;
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
		/** @type {{ [key: string]: Partial<SbpState> }} */
		const result = await browser.storage.sync.get(this.#key);
		console.log(`Loaded state: ${JSON.stringify(result[this.#key])}`);
		this.#updateValue(result[this.#key]);
	}

	/**
	 * Update the store and save its value to persistent storage.
	 *
	 * @param {Partial<SbpState>} newVal
	 */
	async update(newVal) {
		this.#updateValue(newVal);
		const { syncing, initialized, connected, error, activeView, ...toSave } =
			this.#value;
		await browser.storage.sync.set({ [this.#key]: toSave });
		console.log(`Saved state: ${JSON.stringify(toSave)}`);
	}

	// Base properties

	get letter() {
		return this.#value.letter ?? this.#value.gameData.validLetters[0] ?? "";
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

	get initialized() {
		return this.#value.initialized;
	}

	get connected() {
		return this.#value.connected;
	}

	get error() {
		return this.#value.error;
	}

	// Derived properties

	get gameStats() {
		return getWordStats(this.#value.gameData.answers);
	}

	get wordStats() {
		console.log(`Getting word states from`, this.#value.words);
		return getWordStats(this.#value.words);
	}

	get thresholds() {
		return getThresholds(
			this.#value.gameData.answers,
			this.#value.gameData.pangrams,
		);
	}
}
