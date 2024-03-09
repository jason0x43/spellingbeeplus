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
	borrowedWords: string[],
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
	newName: string;
};

type SyncDelegate = {
	onName: (data: { id: string; name: string }) => void;
	onJoin: (data: { id: string; name: string }) => void;
	onLeave: (id: string) => void;
	onSync: (words: string[]) => void;
	onSyncRequest: (id: string) => string[] | false;
	onError: (kind: string, message: string) => void;
	getState: () => GameState;
	updateState: (newState: GameState) => GameState;
};

type SyncHandle = {
	updateName: (name: string) => Promise<void>;
};

type SyncConfig = {
	apiKey: str;
	apiHost: str
};

