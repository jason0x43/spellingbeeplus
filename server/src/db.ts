import { Database as SqliteDatabase } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import * as path from "node:path";
import type {
	ColumnType,
	Generated,
	Insertable,
	Selectable,
	Updateable,
} from "kysely";
import { CamelCasePlugin, Kysely, sql } from "kysely";
import { BunSqliteDialect } from "kysely-bun-sqlite";
import type { GameId, NytGameId, PlayerId, WordId } from "./types.js";
import { log } from "./util.js";

/**
 * Players.
 */
export type PlayersTable = {
	/** The NYT ID of the player; negative numbers are fake */
	id: PlayerId;
	/** The player's display name */
	name: string;
	createdAt: ColumnType<string, never, never>;
};

export type Player = Selectable<PlayersTable>;
export type NewPlayer = Insertable<PlayersTable>;
export type PlayerUpdate = Updateable<PlayersTable>;

/**
 * A game synced between two or more players.
 */
export type GamesTable = {
	id: Generated<GameId>;
	/** The NYT ID of the game */
	nytGameId: NytGameId;
	/** Canonical key for the set of synced player IDs */
	playersKey: string;
	createdAt: ColumnType<string, never, never>;
};

export type Game = Selectable<GamesTable>;
export type NewGame = Insertable<GamesTable>;
export type GameUpdate = Updateable<GamesTable>;

/**
 * Players in a synced game.
 */
export type GamePlayersTable = {
	/** Game in GamesTable */
	gameId: GameId;
	/** Player in the PlayersTable */
	playerId: PlayerId;
	createdAt: ColumnType<string, never, never>;
};

export type GamePlayer = Selectable<GamePlayersTable>;
export type NewGamePlayer = Insertable<GamePlayersTable>;
export type GamePlayerUpdate = Updateable<GamePlayersTable>;

/**
 * Words in a synced game.
 */
export type WordsTable = {
	id: Generated<WordId>;
	/** The ID of the game entry */
	gameId: GameId;
	/** The ID of the player that owns this word entry */
	playerId: PlayerId | null;
	/** The word added to the game */
	word: string;
	createdAt: ColumnType<string, never, never>;
};

export type Word = Selectable<WordsTable>;
export type NewWord = Insertable<WordsTable>;
export type WordUpdate = Updateable<WordsTable>;

/**
 * The database schema
 */
export type Database = {
	games: GamesTable;
	players: PlayersTable;
	gamePlayers: GamePlayersTable;
	words: WordsTable;
};

function createPlayersKey(playerIds: PlayerId[]): string {
	const uniqueIds = Array.from(new Set(playerIds));
	uniqueIds.sort((a, b) => a - b);
	return uniqueIds.join("-");
}

function resolveDbPath(): string {
	const envPath = process.env.DB_PATH;
	if (envPath && envPath.trim() !== "") {
		return envPath;
	}
	return path.join(process.cwd(), "data.db");
}

export class Db {
	#db: Kysely<Database>;

	constructor() {
		const dbPath = resolveDbPath();

		if (dbPath !== ":memory:") {
			mkdirSync(path.dirname(dbPath), { recursive: true });
		}

		const sqlite = new SqliteDatabase(dbPath);
		sqlite.run("PRAGMA foreign_keys = ON");

		log.info(`Using SQLite database: ${sqlite.filename}`);

		this.#db = new Kysely<Database>({
			dialect: new BunSqliteDialect({
				database: sqlite,
			}),
			plugins: [new CamelCasePlugin()],
		});
	}

	get db() {
		return this.#db;
	}

	async createPlayer(data: {
		playerId: PlayerId;
		name: string;
	}): Promise<Player> {
		await this.#db
			.insertInto("players")
			.values({
				id: data.playerId,
				name: data.name,
			})
			.executeTakeFirstOrThrow();

		return await this.getPlayer(data.playerId);
	}

	async getPlayer(playerId: PlayerId): Promise<Player> {
		return await this.#db
			.selectFrom("players")
			.selectAll()
			.where("id", "=", playerId)
			.executeTakeFirstOrThrow();
	}

	async getPlayerOptional(playerId: PlayerId): Promise<Player | null> {
		const player = await this.#db
			.selectFrom("players")
			.selectAll()
			.where("id", "=", playerId)
			.executeTakeFirst();
		return player ?? null;
	}

	async upsertPlayer(data: {
		playerId: PlayerId;
		name: string;
	}): Promise<Player> {
		await this.#db
			.insertInto("players")
			.values({
				id: data.playerId,
				name: data.name,
			})
			.onConflict((oc) => oc.column("id").doUpdateSet({ name: data.name }))
			.execute();

		return await this.getPlayer(data.playerId);
	}

	async getOrCreateGame(data: {
		gameId: NytGameId;
		playerIds: PlayerId[];
	}): Promise<Game> {
		const playersKey = createPlayersKey(data.playerIds);
		const uniquePlayerIds = Array.from(new Set(data.playerIds));
		uniquePlayerIds.sort((a, b) => a - b);

		for (const playerId of uniquePlayerIds) {
			await this.getPlayer(playerId);
		}

		await this.#db
			.insertInto("games")
			.values({ nytGameId: data.gameId, playersKey })
			.onConflict((oc) =>
				oc.columns(["nytGameId", "playersKey"]).doNothing(),
			)
			.execute();

		const game = await this.#db
			.selectFrom("games")
			.selectAll()
			.where(({ eb, and }) =>
				and([
					eb("nytGameId", "=", data.gameId),
					eb("playersKey", "=", playersKey),
				]),
			)
			.executeTakeFirstOrThrow();

		await this.#db
			.insertInto("gamePlayers")
			.values(
				uniquePlayerIds.map((playerId) => ({
					gameId: game.id,
					playerId,
				})),
			)
			.onConflict((oc) => oc.columns(["gameId", "playerId"]).doNothing())
			.execute();

		return game;
	}

	async getGame(gameId: GameId): Promise<Game> {
		return this.#db
			.selectFrom("games")
			.selectAll()
			.where("id", "=", gameId)
			.executeTakeFirstOrThrow();
	}

	async getGameByNytIds(
		gameId: NytGameId,
		playerIds: PlayerId[],
	): Promise<Game> {
		const playersKey = createPlayersKey(playerIds);
		return await this.#db
			.selectFrom("games")
			.selectAll()
			.where(({ eb, and }) =>
				and([
					eb("nytGameId", "=", gameId),
					eb("playersKey", "=", playersKey),
				]),
			)
			.executeTakeFirstOrThrow();
	}

	async getPlayerIds(gameId: GameId): Promise<PlayerId[]> {
		const result = await this.#db
			.selectFrom("players")
			.innerJoin("gamePlayers", "players.id", "gamePlayers.playerId")
			.select("players.id")
			.where("gameId", "=", gameId)
			.execute();
		return result.map((row) => row.id);
	}

	async addWords(data: {
		gameId: GameId;
		words: Record<string, PlayerId | null>;
	}): Promise<void> {
		for (const word in data.words) {
			const playerId = data.words[word];
			const player = playerId && (await this.getPlayer(playerId));
			await this.addWord({
				gameId: data.gameId,
				word,
				playerId: player?.id,
			});
		}
	}

	async addWord(data: NewWord): Promise<void> {
		await this.#db
			.insertInto("words")
			.values(data)
			.onConflict((oc) =>
				oc.columns(["gameId", "word"]).doUpdateSet({
					playerId:
						sql`CASE WHEN excluded.player_id IS NULL OR player_id IS NULL THEN NULL ELSE player_id END`,
				}),
			)
			.execute();
	}

	async getWords(gameId: GameId): Promise<Word[]> {
		return this.#db
			.selectFrom("words")
			.selectAll()
			.where("gameId", "=", gameId)
			.execute();
	}
}
