import type { GameId, GameInfo, NytGameId, PlayerId } from "../src/types.js";

export type Listener<T> = (newVal: T, oldVal: T) => void;

export type Config = {
	apiKey: string;
	apiHost: string;
	appVersion: string;
	extensionId: string;
	teamId: string;
};

export type Store<T> = {
	subscribe(listener: Listener<T>): void;
	value: T;
	update(newVal: Partial<T>): Promise<void>;
	load(): Promise<void>;
};

export type GameData = {
	id: NytGameId;
	answers: string[];
	centerLetter: string;
	outerLetter: string;
	pangrams: string[];
	validLetters: string[];
};

export type Player = {
	id: PlayerId;
	name: string;
};

export type SbpState = {
	letter: string;
	gameData: GameData;
	rank: Rank;
	lastWordAddedAt: number;
	activeView: "hints" | "sync" | null;
	player: Player;
	friends: Player[];
	newName: string;
	syncing: boolean;
	syncData: GameInfo & {
		friend: Player;
	};
	status: "Starting" | "Connecting" | "Connected" | "Not connected";
	error?: string | undefined;
};

export type SyncDelegate = {
	/** Called when this player has joined the server */
	onConnect: () => void;
	/** Called when another player joins the server */
	onJoin: (data: { id: PlayerId; name: string }) => void;
	/** Called when a client leaves */
	onLeave: (id: PlayerId) => void;
	/** Called when a sync request has been accepted */
	onSync: (
		player: PlayerId,
		game: GameId,
		words: Record<string, PlayerId | null>,
	) => Promise<void>;
	/** Called when the extension receives a sync request */
	onSyncRequest: (
		player: PlayerId,
	) => { gameId: NytGameId; words: string[] } | false;
	/** Called when the other player refused a sync request */
	onSyncRejected: (player: PlayerId, game: NytGameId) => void;
	/** Called when an error has occured on the server */
	onError: (kind: string, message: string) => void;
	/** A word was added to the game by another player */
	onWordAdded: (word: string, playerId: PlayerId) => void;
	/** Return the current app state */
	getState: () => SbpState;
	/** Find a player record  */
	findPlayer: (id: PlayerId) => Player | undefined;
	/** Update the app state */
	updateState: (update: Partial<SbpState>) => Promise<void>;
	/** Log a message to the console */
	log: (message: string) => void;
};

export type SyncHandle = {
	updateName: (name: string) => Promise<void>;
};

export type SyncConfig = {
	apiKey: string;
	apiHost: string;
};

export type StoreOptions<T> = {
	noPersist?: (keyof T)[];
};

export type Rank =
	| "Beginner"
	| "Good Start"
	| "Moving Up"
	| "Good"
	| "Solid"
	| "Nice"
	| "Great"
	| "Amazing"
	| "Genius"
	| "Queen Bee";

export type SbState = {
	states: {
		puzzleId: `${number}`;
		data: {
			answers: string[];
			isRevealed: boolean;
			rank:
				| "Beginner"
				| "Good Start"
				| "Moving Up"
				| "Good"
				| "Solid"
				| "Nice"
				| "Great"
				| "Amazing"
				| "Genius"
				| "Queen Bee";
			isPlayingArchive: boolean;
		};
		schemaVersion: `${number}.${number}.${number}`;
		timestamp: number;
		printDate: string;
	}[];
};
