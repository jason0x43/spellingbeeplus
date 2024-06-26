type Listener<T> = (newVal: T, oldVal: T) => void;

type Config = {
	apiKey: string;
	apiHost: string;
	appVersion: string;
};

type Store<T> = {
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
	id: string;
	name: string;
};

type Rank =
	| "beginner"
	| "good start"
	| "moving up"
	| "good"
	| "solid"
	| "nice"
	| "great"
	| "amazing"
	| "genius";

type SbpState = {
	letter: string;
	gameData: GameData;
	borrowedWords: string[];
	words: string[];
	rank: Rank;
	activeView: "hints" | "sync" | null;
	player: Player;
	friends: Player[];
	friendId: string;
	newName: string;
	syncing: boolean;
	status: 'Starting' | 'Connecting' | 'Connected' | 'Not connected';
	error?: string | undefined;
};

type SyncDelegate = {
	onJoin: (data: { id: string; name: string }) => void;
	onLeave: (id: string) => void;
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

type SyncHandle = {
	updateName: (name: string) => Promise<void>;
};

type SyncConfig = {
	apiKey: str;
	apiHost: str;
};

type StoreOptions<T> = {
	noPersist?: (keyof T)[];
};
