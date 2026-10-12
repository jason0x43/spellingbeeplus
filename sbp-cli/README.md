# sbp-cli

A development CLI for the SpellingBeePlus server. It can listen on the sync
websocket as a fake player, and read or add words to synced games.

## Setup

```sh
bun install
./sbp --help
```

## Environment

Configuration comes from environment variables. Each one except
`SBP_CLI_STATE_DIR` can be overridden with a command-line option.

| Variable           | Option           | Default          | Description                                       |
| ------------------ | ---------------- | ---------------- | ------------------------------------------------- |
| `SBP_API_KEY`      | `--api-key`      | (required)       | API key the server expects in `x-api-key`. `API_KEY` also works. |
| `SBP_API_HOST`     | `--api-host`     | `localhost:3000` | Server host, with or without `https://`           |
| `SBP_TLS_INSECURE` | `--tls-insecure` | `false`          | Set to `true` to skip TLS certificate checks (dev only) |
| `SBP_CLI_STATE_DIR`| none             | `$XDG_CONFIG_HOME/sbp-cli` or `~/.config/sbp-cli` | Where the CLI keeps its fake player's state |

The usual way to set these is a `.env` file in this directory, which `./sbp`
loads regardless of the current directory. It isn't committed, because it holds
the API key. Variables set in your shell take precedence over the file.

```sh
SBP_API_KEY=<key>
SBP_API_HOST=localhost:3066
SBP_TLS_INSECURE=true
```

## Commands

- `./sbp ws`: connect to the sync websocket and listen for and respond to
  events, with an interactive prompt unless you pass `--no-repl`.
- `./sbp game info <gameId>`: show the current state of a synced game.
- `./sbp game add <gameId> <word> [words...]`: add words to a synced game.

Run any command with `--help` to see its options.
