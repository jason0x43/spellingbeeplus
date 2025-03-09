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
	await db.schema
		.createTable("players")
		.addColumn("id", "integer", (col) => col.primaryKey())
		.addColumn("name", "text", (col) => col.notNull())
		.addColumn("created_at", "text", (col) =>
			col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
		)
		.execute();

	await db.schema
		.createTable("games")
		.addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
		.addColumn("nyt_game_id", "integer", (col) => col.notNull())
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
}
