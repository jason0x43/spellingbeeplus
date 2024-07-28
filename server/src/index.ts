import { connect, getFile, getToken, hello, ws } from "./handlers.js";
import { ClientId } from "./message.js";
import { keyRequired, tokenRequired, useCors } from "./middlewares.js";
import { Client, createServer, Websocket } from "./server.js";
import { getEnv, log } from "./util.js";

const apiKey = getEnv("API_KEY");
const clients = new Map<ClientId, Client>();
const connections = new Map<Websocket, ClientId>();
const tokens = new Map<string, Date>();
const version = Number(Date.now());
const port = process.env.API_PORT ?? 3000;

// If an SSL key is defined in the environment, create an HTTPS server.
// Otherwise, use HTTP.
const server = process.env.SSL_KEY_NAME
	? createServer(
			{ clients, connections, apiKey, tokens, version },
			{
				cert_file_name: `${process.env.SSL_KEY_NAME}.pem`,
				key_file_name: `${process.env.SSL_KEY_NAME}-key.pem`,
			},
		)
	: createServer({ clients, connections, apiKey, tokens, version });

server.set_error_handler((_request, response, error) => {
	log.warn(error);
	if (error.message === "not authorized") {
		return response.status(401).send(error.message);
	}
	return response.status(500).send(error.message);
});

server.use(useCors({ extraHeaders: "x-api-key" }));

// Test route
server.get("/", {}, hello);

// Get a token to use when opening a websocket connection
server.get("/token", { middlewares: [keyRequired] }, getToken);

// Open a websocket connection
server.upgrade("/ws", { middlewares: [tokenRequired] }, connect);

// Connect to a websocket
server.ws("/ws", ws);

// Load a static file
server.get("/:file", {}, getFile);

try {
	await server.listen(Number(port));
	log.info(`Listening on port ${port}...`);
} catch (error) {
	log.error(`Failed to attach to port ${port}:`, error);
}
