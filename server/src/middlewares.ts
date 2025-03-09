import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { Context } from "./context.js";
import type { AppEnv } from "./types.js";
import { log } from "./util.js";

export const keyRequired = (ctx: Context) =>
	createMiddleware<AppEnv>(async (c, next) => {
		const apiKey = c.req.header("x-api-key");
		if (!apiKey) {
			log.warn("Missing authorization header");
			throw new HTTPException(401, { message: "not authorized" });
		}

		if (apiKey !== ctx.apiKey) {
			log.warn("Invalid API key");
			throw new HTTPException(401, { message: "not authorized" });
		}

		await next();
	});

export const tokenRequired = (ctx: Context) =>
	createMiddleware<AppEnv>(async (c, next) => {
		const token = c.req.query("token");
		if (!token) {
			log.warn("Missing token");
			throw new HTTPException(401, { message: "not authorized" });
		}

		const expiry = ctx.tokens.get(token);
		if (!expiry) {
			log.warn("Invalid token");
			throw new HTTPException(401, { message: "not authorized" });
		}

		if (expiry < new Date()) {
			log.warn("Expired token");
			throw new HTTPException(401, { message: "not authorized" });
		}

		await next();
	});
