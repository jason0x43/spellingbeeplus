import { createServer } from "node:https";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { Context } from "./context.js";
import { Db } from "./db.js";
import { runMigrations } from "./migrate.js";
import { injectWebSocket, routes } from "./routes.js";
import type { AppEnv } from "./types.js";

// Initialize DB and run migrations
const db = new Db();
console.log("Running database migrations...");
await runMigrations(db.db);
console.log("Database is up to date");

const context = new Context(db);
const port = Number(process.env.API_PORT ?? 3000);
const shutdownTasks: (() => void)[] = [];
const app = new Hono<AppEnv>();

// Log requests
app.use(async (c, next) => {
	const { method, path } = c.req;
	const url = new URL(c.req.url);
	const search = url.search;
	const origin = c.req.header("origin");
	console.debug(`[${method}] ${path}${search ?? ""} (origin=${origin})`);
	await next();
	const { status = 200 } = c.res;
	console.debug(`[${method}] ${path}${search ?? ""} ${status}`);
});

app.use(
	cors({
		origin: ["https://www.nytimes.com", `http://localhost:${port}`],
		allowHeaders: ["x-api-key"],
	}),
);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const appRoutes = app
	.get("/hello", (c) => c.text("Hello, world!"))
	.route("/", routes(context));

export type AppRoutes = typeof appRoutes;

try {
	const serverOptions: Record<string, string> = {};
	if (process.env.USE_SSL === "true") {
		serverOptions.key = await Bun.file("./localhost-key.pem").text();
		serverOptions.cert = await Bun.file("./localhost.pem").text();
	}

	const server = serve({
		fetch: app.fetch,
		createServer: createServer,
		port,
		serverOptions,
	});

	// Enable websocket support for the server
	injectWebSocket(server);

	shutdownTasks.push(() => server.close());
	console.log(`Listening on port ${port}`);
} catch (error) {
	console.log(`Failed to attach to port ${port}:`, error);
}
