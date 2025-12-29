/**
 * @template T
 * @typedef {import("kysely").Kysely<T>} Kysely
 */

import { sql } from "kysely";

/**
 * @param {unknown} value
 * @returns {number}
 */
function toInteger(value) {
	const num = typeof value === "number" ? value : Number(value);
	if (!Number.isInteger(num)) {
		throw new Error(`Expected integer, got ${String(value)}`);
	}
	return num;
}

/**
 * @param {unknown[]} ids
 * @returns {string}
 */
function toPlayersKey(ids) {
	/** @type {number[]} */
	const numbers = ids.map(toInteger);
	const unique = Array.from(new Set(numbers));
	unique.sort((a, b) => a - b);
	return unique.join("-");
}

/**
 * @param {Kysely<any>} db
 * @returns {Promise<void>}
 */
export async function up(db) {
	const gamesTable = await sql`
		SELECT name
		FROM sqlite_master
		WHERE type = 'table' AND name = 'games'
	`.execute(db);

	if (gamesTable.rows.length === 0) {
		return;
	}

	const gameColumns = await sql`PRAGMA table_info(games)`.execute(db);
	const hasPlayersKey = gameColumns.rows.some((col) => col.name === "players_key");
	if (!hasPlayersKey) {
		await db.schema
			.alterTable("games")
			.addColumn("players_key", "text", (col) => col.notNull().defaultTo(""))
			.execute();
	}

	// Backfill any games without a players_key.
	const gamesNeedingKey = await sql`
		SELECT id
		FROM games
		WHERE players_key = ''
	`.execute(db);
	for (const row of gamesNeedingKey.rows) {
		const gameId = toInteger(row.id);
		const players = await sql`
			SELECT player_id AS playerId
			FROM game_players
			WHERE game_id = ${gameId}
			ORDER BY player_id
		`.execute(db);

		if (players.rows.length === 0) {
			throw new Error(
				`Cannot migrate games: game ${String(gameId)} has no game_players`,
			);
		}

		const playersKey = toPlayersKey(players.rows.map((p) => p.playerId));
		await sql`
			UPDATE games
			SET players_key = ${playersKey}
			WHERE id = ${gameId}
		`.execute(db);
	}

	// De-dupe duplicate game records (same nyt_game_id + players_key).
	const dupGroups = await sql`
		SELECT
			nyt_game_id AS nytGameId,
			players_key AS playersKey,
			MIN(id) AS keepId,
			GROUP_CONCAT(id) AS gameIds,
			COUNT(*) AS count
		FROM games
		GROUP BY nyt_game_id, players_key
		HAVING COUNT(*) > 1
	`.execute(db);

	for (const row of dupGroups.rows) {
		const keepId = toInteger(row.keepId);
		const gameIdsRaw = String(row.gameIds ?? "");
		const gameIds = gameIdsRaw
			.split(",")
			.filter((s) => s.trim() !== "")
			.map((s) => toInteger(s));

		for (const dupeId of gameIds) {
			if (dupeId === keepId) {
				continue;
			}

			await sql`
				INSERT OR IGNORE INTO game_players (game_id, player_id, created_at)
				SELECT ${keepId}, player_id, created_at
				FROM game_players
				WHERE game_id = ${dupeId}
			`.execute(db);

			await sql`
				INSERT INTO words (game_id, player_id, word, created_at)
				SELECT ${keepId}, player_id, word, created_at
				FROM words
				WHERE game_id = ${dupeId}
					AND word NOT IN (
						SELECT word FROM words WHERE game_id = ${keepId}
					)
			`.execute(db);

			await sql`DELETE FROM words WHERE game_id = ${dupeId}`.execute(db);
			await sql`DELETE FROM game_players WHERE game_id = ${dupeId}`.execute(db);
			await sql`DELETE FROM games WHERE id = ${dupeId}`.execute(db);
		}
	}

	const gamesStillMissingKey = await sql`
		SELECT id
		FROM games
		WHERE players_key = ''
	`.execute(db);
	if (gamesStillMissingKey.rows.length > 0) {
		throw new Error(
			`Cannot migrate games: ${String(gamesStillMissingKey.rows.length)} games still have empty players_key`,
		);
	}

	// Make words idempotent: one word row per (game_id, word).
	await sql`
		DELETE FROM words
		WHERE id NOT IN (
			SELECT MIN(id)
			FROM words
			GROUP BY game_id, word
		)
	`.execute(db);

	const uniqueWordsIndex = await sql`
		SELECT name
		FROM sqlite_master
		WHERE type = 'index' AND name = 'unique_words_game_id_word'
	`.execute(db);
	if (uniqueWordsIndex.rows.length === 0) {
		await db.schema
			.createIndex("unique_words_game_id_word")
			.on("words")
			.columns(["game_id", "word"])
			.unique()
			.execute();
	}

	const uniqueGamesIndex = await sql`
		SELECT name
		FROM sqlite_master
		WHERE type = 'index' AND name = 'unique_games_nyt_game_id_players_key'
	`.execute(db);
	if (uniqueGamesIndex.rows.length === 0) {
		await db.schema
			.createIndex("unique_games_nyt_game_id_players_key")
			.on("games")
			.columns(["nyt_game_id", "players_key"])
			.unique()
			.execute();
	}
}
