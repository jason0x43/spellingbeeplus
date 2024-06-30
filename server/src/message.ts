import { z } from "zod";

export type ClientId = string & { __type: "ClientId" };
export const ClientId: z.Schema<ClientId> = z.string() as any;

export const Connect = z.object({
	version: z.number(),
	id: ClientId,
});
export type Connect = z.infer<typeof Connect>;

export const Joined = z.object({
	id: ClientId,
	name: z.string(),
});
export type Joined = z.infer<typeof Joined>;

export const Sync = z.object({
	requestId: z.string(),
	words: z.array(z.string()),
});
export type Sync = z.infer<typeof Sync>;

export const ErrMsg = z.object({
	kind: z.enum(["nameUnavailable", "missingName", "invalidCommand"]),
	message: z.string(),
});
export type ErrMsg = z.infer<typeof ErrMsg>;

export const Message = z.union([Connect, Joined, Sync, ErrMsg]);
export type Message = z.infer<typeof Message>;

export const MessageContent = z.union([
	z.object({ connect: Connect }),
	z.object({ setName: z.string() }),
	z.object({ setClientId: ClientId }),
	z.object({ sync: Sync }),
	z.object({ noSync: z.string() }),
	z.object({ joined: Joined }),
	z.object({ left: ClientId }),
	z.object({ error: ErrMsg }),
]);
export type MessageContent = z.infer<typeof MessageContent>;

export const MessageFrom = z.object({
	from: ClientId,
	content: MessageContent,
});
export type MessageFrom = z.infer<typeof MessageFrom>;

export const MessageTo = z.object({
	to: z.union([ClientId, z.null()]),
	content: MessageContent,
});
export type MessageTo = z.infer<typeof MessageTo>;

export function messageFrom(from: ClientId, content: MessageContent): string {
	return JSON.stringify({
		from,
		content,
	} satisfies MessageFrom);
}
