type GameData = {
	answers: string[];
	centerLetter: string;
	outerLetter: string;
	pangrams: string[];
	validLetters: string[];
};

type GameState = {
	letter: string;
	gameData: GameData;
	gameStats: {
		firstLetters: Record<string, number[] | undefined>;
		digraphs: Record<string, number | undefined>;
	};
	borrowedWords: string[];
	words: string[];
	wordStats: {
		firstLetters: Record<string, number[] | undefined>;
		digraphs: Record<string, number | undefined>;
	};
	thresholds: Record<
		string,
		{
			score: number;
			distance: number;
		}
	>;
	rank: string;
	activeView: "hints" | "sync" | null;
	player: { id: string; name: string };
	friends: { id: string; name: string }[];
	friendId: string;
	newName: string | null;
	syncing: boolean;
};

type SyncDelegate = {
	onName: (data: { id: string; name: string }) => void;
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
	getState: () => GameState;
	updateState: (newState: GameState) => GameState;
};

type SyncHandle = {
	updateName: (name: string) => Promise<void>;
};

type SyncConfig = {
	apiKey: str;
	apiHost: str;
};
