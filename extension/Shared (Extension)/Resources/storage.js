const gameStateKey = "sbp-game-state";
const clientIdKey = "sbp-client-id";

/**
 * @param {GameState} state
 */
export async function saveGameState(state) {
	await browser.storage.sync.set({ [gameStateKey]: state });
}

/**
 * @returns {Promise<GameState | undefined>}
 */
export async function loadGameState() {
	const result = await browser.storage.sync.get(gameStateKey);
	return result[gameStateKey];
}

/**
 * @param {string} id
 */
export async function saveClientId(id) {
	await browser.storage.sync.set({ [clientIdKey]: id });
}

/**
 * @returns {Promise<string | undefined>}
 */
export async function loadClientId() {
	const result = await browser.storage.sync.get(clientIdKey);
	return result[clientIdKey];
}
