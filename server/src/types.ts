import { z } from "zod";

export type Client = {
	id: PlayerId;
	name: string;
};

export type Token = string;

export type AppEnv = {
	Variables: object;
};

type TaggedNumber<Tag> = number & { __type: Tag };
const zodId = <T>() => z.custom<T>((val) => !Number.isNaN(Number(val)));

export type GameId = TaggedNumber<"GameId">;
export const GameId = zodId<GameId>();

export type PlayerId = TaggedNumber<"PlayerId">;
export const PlayerId = zodId<PlayerId>();

export type WordId = TaggedNumber<"WordId">;
export const WordId = zodId<WordId>();

export type NytGameId = TaggedNumber<"NytGameId">;
export const NytGameId = zodId<NytGameId>();

export const GameInfo = z.object({
	nytGameId: NytGameId,
	gameId: GameId,
	words: z.record(z.string(), PlayerId.nullable()),
});
export type GameInfo = z.infer<typeof GameInfo>;
