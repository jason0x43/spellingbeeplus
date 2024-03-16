const gameStateKey = "sbp-game-state";
const clientIdKey = "sbp-client-id";

/**
 * @param {GameState} state
 */
export async function saveGameState(state) {
	await browser.storage.sync.set({ [gameStateKey]: state });
	// console.log(`Saved game state: ${JSON.stringify(state)}`);
	console.log(`Saved player state: ${JSON.stringify(state.player)}`);
}

/**
 * @returns {Promise<GameState | undefined>}
 */
export async function loadGameState() {
	const result = await browser.storage.sync.get(gameStateKey);
	const state = result[gameStateKey];
	// console.log(`Loaded game state: ${JSON.stringify(state)}`);
	console.log(`Loaded player state: ${JSON.stringify(state.player)}`);
	return state;
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
