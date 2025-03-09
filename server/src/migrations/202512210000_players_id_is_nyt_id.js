/**
 * @template T
 * @typedef {import("kysely").Kysely<T>} Kysely
 */

import { sql } from "kysely";

/**
 * @param {Kysely<any>} db
 * @returns {Promise<void>}
 */
export async function up(db) {
	const playersTable = await sql`
		SELECT name
		FROM sqlite_master
		WHERE type = 'table' AND name = 'players'
	`.execute(db);

	if (playersTable.rows.length === 0) {
		return;
	}

	const columns = await sql`PRAGMA table_info(players)`.execute(db);
	const hasNytPlayerIdColumn = columns.rows.some(
		(col) => col.name === "nyt_player_id",
	);

	if (!hasNytPlayerIdColumn) {
		return;
	}

	const dupes = await sql`
		SELECT nyt_player_id AS nytPlayerId, COUNT(*) AS count
		FROM players
		GROUP BY nyt_player_id
		HAVING COUNT(*) > 1
	`.execute(db);
	if (dupes.rows.length > 0) {
		throw new Error(
			`Cannot migrate players table: duplicate nyt_player_id values (${dupes.rows.length} duplicates).`,
		);
	}

	await db.schema.alterTable("words").renameTo("words_old").execute();
	await db.schema
		.alterTable("game_players")
		.renameTo("game_players_old")
		.execute();
	await db.schema.alterTable("players").renameTo("players_old").execute();

	await db.schema
		.createTable("players")
		.addColumn("id", "integer", (col) => col.primaryKey())
		.addColumn("name", "text", (col) => col.notNull())
		.addColumn("created_at", "text", (col) =>
			col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
		)
		.execute();

	await db.schema
		.createTable("game_players")
		.addColumn("game_id", "integer", (col) =>
			col.notNull().references("games.id"),
		)
		.addColumn("player_id", "integer", (col) =>
			col.notNull().references("players.id"),
		)
		.addColumn("created_at", "text", (col) =>
			col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
		)
		.addUniqueConstraint("unique_player_game", ["game_id", "player_id"])
		.execute();

	await db.schema
		.createTable("words")
		.addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
		.addColumn("game_id", "integer", (col) =>
			col.notNull().references("games.id"),
		)
		.addColumn("player_id", "integer", (col) => col.references("players.id"))
		.addColumn("word", "text", (col) => col.notNull())
		.addColumn("created_at", "text", (col) =>
			col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
		)
		.execute();

	await sql`
		INSERT INTO players (id, name, created_at)
		SELECT nyt_player_id, name, created_at
		FROM players_old
	`.execute(db);

	await sql`
		INSERT INTO game_players (game_id, player_id, created_at)
		SELECT gp.game_id, p.nyt_player_id, gp.created_at
		FROM game_players_old AS gp
		INNER JOIN players_old AS p ON p.id = gp.player_id
	`.execute(db);

	await sql`
		INSERT INTO words (id, game_id, player_id, word, created_at)
		SELECT w.id, w.game_id, p.nyt_player_id, w.word, w.created_at
		FROM words_old AS w
		LEFT JOIN players_old AS p ON p.id = w.player_id
	`.execute(db);

	await db.schema.dropTable("words_old").execute();
	await db.schema.dropTable("game_players_old").execute();
	await db.schema.dropTable("players_old").execute();
}
