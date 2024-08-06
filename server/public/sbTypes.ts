export type LatestsResponse = {
	player: {
		user_id: number;
		last_updated: number;
	};
	states: GameState[];
	user_id: number;
};

export type GameState = {
	game_data: {
		answers: string[];
		isRevealed: boolean;
		rank: string;
	};
	puzzle_id: string;
	game: "spelling_bee";
	user_id: number;
	version: string;
	timestamp: number;
	print_date: string;
	schema_version: string;
};
