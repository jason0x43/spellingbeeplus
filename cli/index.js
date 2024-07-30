import { Command } from "@commander-js/extra-typings";
import { readFileSync } from "node:fs";

/** @typedef {import("./types.ts").GameData} GameData */

const program = new Command();

program
	.name("sb")
	.description("Interact with SpellingBee")
	.configureHelp({ sortSubcommands: true })
	.showHelpAfterError()
	.version("1.0.0");

program
	.command("state")
	.description("Get the state for a game")
	.argument("<id>", "A game id")
	.action(async (id) => {
		const data = await getGameState(id);
		console.log(JSON.stringify(data, null, 2));
	});

program
	.command("add")
	.description("Add a word to a puzzle")
	.argument("<id>", "A puzzle id")
	.argument("<word>", "A word to add")
	.action(async (id, word) => {
		const data = await getGameState(id);

		const newAswers = [];
		for (const ans of data.game_data.answers) {
			if (!newAswers.includes(ans)) {
				newAswers.push(ans);
			}
		}
		data.game_data.answers = newAswers;

		if (!data.game_data.answers.includes(word)) {
			data.game_data.answers.push(word);
			data.timestamp = Date.now();
			await setGameState(data);
		}
	});

try {
	await program.parseAsync();
} catch (error) {
	console.error(`Error: ${error}`);
}

function loadCookie() {
	return readFileSync("cookie.txt", "utf8");
}

/**
 * @param {string} gameId
 * @returns {Promise<GameData>}
 */
async function getGameState(gameId) {
	const params = new URLSearchParams({ puzzle_ids: gameId });
	const resp = await fetch(
		`https://www.nytimes.com/svc/games/state/spelling_bee/latests?${params}`,
		{
			headers: {
				cookie: loadCookie(),
			},
		},
	);

	if (!resp.ok) {
		throw new Error("Failed to get game state");
	}

	const data = await resp.json();
	return data.states[0];
}

/**
 * @param {GameData} state
 */
async function setGameState(state) {
	const resp = await fetch("https://www.nytimes.com/svc/games/state", {
		method: "POST",
		headers: {
			cookie: loadCookie(),
			"Content-Type": "application/json",
		},
		body: JSON.stringify(state),
	});

	if (!resp.ok) {
		const text = await resp.text();
		throw new Error(`Failed to set game state: ${text}`);
	}
}
