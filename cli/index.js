import { Command } from "@commander-js/extra-typings";
import { readFileSync } from "node:fs";
import * as cheerio from "cheerio";
import * as vm from "node:vm";

/** @typedef {import("./types.ts").GameState} GameState */
/** @typedef {import("./types.ts").GameData} GameData */
/** @typedef {import("./types.ts").TodayData} TodayData */

const program = new Command();

program
	.name("sb")
	.description("Interact with SpellingBee")
	.configureHelp({ sortSubcommands: true })
	.showHelpAfterError()
	.version("1.0.0");

program
	.command("game")
	.description("Get full information for today's game")
	.action(async (id) => {
		const data = await getTodaysGame();
		console.log(JSON.stringify(data, null, 2));
	});

program
	.command("state")
	.description("Get the state for a game")
	.argument("[id]", "A game id", Number)
	.action(async (id) => {
		id = id ?? (await getTodaysGame()).id;
		const data = await getGameState(id);
		console.log(JSON.stringify(data, null, 2));
	});

program
	.command("add")
	.description("Add a word to a puzzle")
	.argument("word", "A word to add")
	.argument("[words...]", "More words to add")
	.option("-i, --id <gameId>", "A puzzle id", Number)
	.action(async (word, words, options) => {
		const id = options.id ?? (await getTodaysGame()).id;
		const data = await getGameState(id);

		const toAdd = [];

		if (!data.game_data.answers.includes(word)) {
			toAdd.push(word);
		}

		for (const w of words) {
			if (!data.game_data.answers.includes(w)) {
				toAdd.push(w);
			}
		}

		if (toAdd.length === 0) {
			return;
		}

		data.game_data.answers.push(...toAdd);
		data.timestamp = timestamp();

		await setGameState(data);
	});

program
	.command("remove")
	.description("Remove a word from a puzzle")
	.argument("<word>", "A word to add")
	.argument("[id]", "A puzzle id", Number)
	.action(async (word, id) => {
		id = id ?? (await getTodaysGame()).id;
		const data = await getGameState(id);

		const index = data.game_data.answers.indexOf(word);
		if (index === -1) {
			return;
		}

		data.game_data.answers.splice(index, 1);
		data.timestamp = timestamp();
		await setGameState(data);
	});

try {
	await program.parseAsync();
} catch (error) {
	console.error(`Error: ${error}`);
}

function loadCookie() {
	return readFileSync("cookie.txt", "utf8");
}

/*
 * @returns {Promise<GameData>}
 */
async function getTodaysGame() {
	const resp = await fetch(`https://www.nytimes.com/puzzles/spelling-bee`, {
		headers: {
			cookie: loadCookie(),
		},
	});

	const html = await resp.text();
	const $ = cheerio.load(html);
	const script = $("script")
		.map((_, elem) => $(elem).contents().text())
		.toArray()
		.find((scr) => scr.includes("window.gameData = "));

	if (!script) {
		throw new Error("Couldn't find reactContext script");
	}

	/** @type {Record<string, any>} */
	const context = {
		window: {},
	};

	vm.createContext(context);
	vm.runInContext(script, context);

	/** @type {TodayData} */
	const today = context.window.gameData;
	return today.today;
}

/**
 * @param {number} gameId
 * @returns {Promise<GameState>}
 */
async function getGameState(gameId) {
	const params = new URLSearchParams({ puzzle_ids: `${gameId}` });
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
 * @param {GameState} state
 */
async function setGameState(state) {
	console.log(JSON.stringify(state));
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

/**
 * Get the current timestamp in seconds
 */
function timestamp() {
	return Math.floor(Date.now() / 1000);
}
