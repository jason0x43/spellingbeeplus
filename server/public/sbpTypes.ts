import type { ClientId } from '../src/message.js';

export type Listener<T> = (newVal: T, oldVal: T) => void;

export type Config = {
	apiKey: string;
	apiHost: string;
	appVersion: string;
};

export type Store<T> = {
	subscribe(listener: Listener<T>): void;
	value: T;
	update(newVal: Partial<T>): Promise<void>;
	load(): Promise<void>;
};

type GameData = {
	answers: string[];
	centerLetter: string;
	outerLetter: string;
	pangrams: string[];
	validLetters: string[];
};

type Player = {
	id: ClientId;
	name: string;
};

export type Rank =
	| "beginner"
	| "good start"
	| "moving up"
	| "good"
	| "solid"
	| "nice"
	| "great"
	| "amazing"
	| "genius";

export type SbpState = {
	letter: string;
	gameData: GameData;
	borrowedWords: string[];
	words: string[];
	rank: Rank;
	activeView: "hints" | "sync" | null;
	player: Player;
	friends: Player[];
	friendId: ClientId;
	newName: string;
	syncing: boolean;
	status: 'Starting' | 'Connecting' | 'Connected' | 'Not connected';
	error?: string | undefined;
};

export type SyncDelegate = {
	onJoin: (data: { id: ClientId; name: string }) => void;
	onLeave: (id: ClientId) => void;
	// Called when a device that made a sync request receives confirmation
	// that the request was accepted
	onSync: (words: string[]) => void;
	// Called when the extension receives a sync request
	onSyncRequest: (id: string) => string[] | false;
	// Called when the other player refused a sync request
	onSyncRefused: (id: string) => void;
	onError: (kind: string, message: string) => void;
	getState: () => SbpState;
	updateState: (update: Partial<SbpState>) => Promise<void>;
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
