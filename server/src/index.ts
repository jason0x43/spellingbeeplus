import { connect, getFile, getToken, hello, ws } from "./handlers.js";
import { keyRequired, tokenRequired, useCors } from "./middlewares.js";
import { Client, createServer } from "./server.js";
import { getEnv, log } from "./util.js";

const apiKey = getEnv("API_KEY");
const clients = new Map<string, Client>();
const tokens = new Map<string, Date>();
const version = Number(Date.now());
const port = process.env.API_PORT ?? 3000;

const server = process.env.SSL_KEY_NAME
	? createServer(
			{ clients, apiKey, tokens, version },
			{
				cert_file_name: `${process.env.SSL_KEY_NAME}.pem`,
				key_file_name: `${process.env.SSL_KEY_NAME}-key.pem`,
			},
		)
	: createServer({ clients, apiKey, tokens, version });

server.set_error_handler((_request, response, error) => {
	log.warn(error);
	if (error.message === "not authorized") {
		return response.status(401).send(error.message);
	}
	return response.status(500).send(error.message);
});

server.use(useCors({ extraHeaders: "x-api-key" }));

server.get("/", {}, hello);
server.get("/token", { middlewares: [keyRequired] }, getToken);
server.upgrade("/ws", { middlewares: [tokenRequired] }, connect);
server.ws("/ws", ws);
server.get("/:file", {}, getFile);

try {
	await server.listen(Number(port));
	log.info(`Listening on port ${port}...`);
} catch (error) {
	log.error(`Failed to attach to port ${port}:`, error);
}
