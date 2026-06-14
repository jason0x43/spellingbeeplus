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
	const columns = await sql`PRAGMA table_info(game_players)`.execute(db);
	const hasLastSyncedAt = columns.rows.some(
		(column) => column.name === "last_synced_at",
	);

	if (!hasLastSyncedAt) {
		await db.schema
			.alterTable("game_players")
			.addColumn("last_synced_at", "integer", (column) =>
				column.notNull().defaultTo(0),
			)
			.execute();

		await sql`
			UPDATE game_players
			SET last_synced_at =
				CAST(strftime('%s', created_at) AS INTEGER) * 1000 + game_id
		`.execute(db);
	}
}
