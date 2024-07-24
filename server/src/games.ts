export type Game = {
	player1: string;
	player2: string;
	words: {
		word: string;
		player: string;
	}[];
};

let games: Map<string, Game>;

export function getGame(player1: string, player2: string): Game | undefined {
	return getGames().get(`${player1}:${player2}`);
}

function getGames(): Map<string, Game> {
	if (!games) {
		games = new Map();
	}
	return games;
}
