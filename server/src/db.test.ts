import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Db } from "./db.js";
import { runMigrations } from "./migrate.js";
import type { NytGameId, PlayerId } from "./types.js";

describe("latest synced game", () => {
	let db: Db;

	beforeAll(async () => {
		process.env.DB_PATH = ":memory:";
		db = new Db();
		await runMigrations(db.db);

		for (const playerId of [1, 2, 3]) {
			await db.createPlayer({
				playerId: playerId as PlayerId,
				name: `Player ${playerId}`,
			});
		}
	});

	afterAll(async () => {
		await db.db.destroy();
	});

	test("returns the pairing most recently synced by the player", async () => {
		const nytGameId = 100 as NytGameId;
		const first = await db.getOrCreateGame({
			gameId: nytGameId,
			playerIds: [1 as PlayerId, 2 as PlayerId],
		});
		const second = await db.getOrCreateGame({
			gameId: nytGameId,
			playerIds: [1 as PlayerId, 3 as PlayerId],
		});

		expect(await db.getLatestGameForPlayer(nytGameId, 1 as PlayerId)).toEqual(
			second,
		);

		await db.getOrCreateGame({
			gameId: nytGameId,
			playerIds: [1 as PlayerId, 2 as PlayerId],
		});

		expect(await db.getLatestGameForPlayer(nytGameId, 1 as PlayerId)).toEqual(
			first,
		);
	});
});
