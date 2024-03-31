/**
 * @template T
 * @implements Store<T>
 */
class PersistentStore {
	/** @type {Set<Listener<T>>} */
	#listeners = new Set();

	/** @type {string} */
	#key;

	/** @type {T} */
	#value;

	/**
	 * @param {string} key
	 * @param {T} initialValue
	 */
	constructor(key, initialValue) {
		this.#key = key;
		this.#value = initialValue;
	}

	/**
	 * @param {Listener<T>} listener
	 */
	subscribe(listener) {
		this.#listeners.add(listener);
	}

	/**
	 * @returns {T}
	 */
	get value() {
		return this.#value;
	}

	/**
	 * Load this store's value from persistent storage.
	 *
	 * @returns {Promise<void>}
	 */
	async load() {
		const result = await browser.storage.sync.get(this.#key);
		this.update(result[this.#key]);
	}

	/**
	 * Update the store and save its value to persistent storage.
	 *
	 * @param {T} newVal
	 */
	async update(newVal) {
		const oldVal = this.#value;
		this.#value = newVal;
		await browser.storage.sync.set({ [this.#key]: newVal });

		for (const listener of this.#listeners) {
			listener(this.#value, oldVal);
		}
	}
}

/**
 * @template C
 * @param {string} key
 * @param {C} initialValue
 * @returns {Store<C>}
 */
export function createStore(key, initialValue) {
	return new PersistentStore(key, initialValue);
}
