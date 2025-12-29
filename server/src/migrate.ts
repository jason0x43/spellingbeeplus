import {
	type Kysely,
	type Migration,
	type MigrationProvider,
	Migrator,
} from "kysely";

import * as initMigration from "./migrations/202503091617_init.js";
import * as playersIdIsNytIdMigration from "./migrations/202512210000_players_id_is_nyt_id.js";
import * as gamesPlayersKeyUniqueMigration from "./migrations/202512290000_games_players_key_unique.js";

const provider: MigrationProvider = {
	async getMigrations(): Promise<Record<string, Migration>> {
		return {
			// Keep the name identical to the previous FileMigrationProvider output.
			"202503091617_init": {
				up: initMigration.up,
			},
			"202512210000_players_id_is_nyt_id": {
				up: playersIdIsNytIdMigration.up,
			},
			"202512290000_games_players_key_unique": {
				up: gamesPlayersKeyUniqueMigration.up,
			},
		};
	},
};

// biome-ignore lint/suspicious/noExplicitAny: any is needed in migrations
export async function runMigrations(db: Kysely<any>) {
	const migrator = new Migrator({
		db,
		provider,
	});

	const resultSet = await migrator.migrateToLatest();

	for (const result of resultSet.results ?? []) {
		if (result.status === "Success") {
			console.log(`Applied migration ${result.migrationName}`);
		} else {
			console.log(
				`Applying migration ${result.migrationName} failed: ${resultSet.error}`,
			);
		}
	}

	if (resultSet.error) {
		throw resultSet.error;
	}
}
