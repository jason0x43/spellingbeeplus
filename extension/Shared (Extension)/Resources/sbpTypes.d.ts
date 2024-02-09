type Message = {
	to?: string;
	from?: string;
	content:
		| { setName: string }
		| { connect: { version: number; id: string } }
		| { sync: { requestId: string; words: string[] } }
		| { joined: { id: string; name: string } }
		| { left: string }
		| { error: { kind: string; message: string } };
};

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
	activeView: 'hints' | 'sync' | null;
};
