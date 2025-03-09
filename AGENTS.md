# SpellingBeePlus agent notes

## Build / lint / test
- Install deps: `cd server && bun install` (also `cd cli && bun install`, `cd extension && bun install`)
- Server dev: `cd server && bun run dev` (expects `localhost.pem` + `localhost-key.pem`; `API_PORT=3000`)
- Server build: `cd server && bun run build` (outputs native binary `server/server`)
- Typecheck: `cd server && bunx tsc` and `cd server/public && bunx tsc`
- Format/lint: no ESLint; follow `.prettierrc`; optional `bunx prettier --check .` / `bunx prettier --write .`
- Tests: none currently; if adding Bun tests: `cd server && bun test` / single: `bun test path/to/file.test.ts -t "name"`
- Extension tooling: `cd extension && node dev --help`; build sim: `node dev build sim --dev`
- CLI: `cd cli && ./sb --help` (reads `cli/cookie.txt`)

## Code style
- ESM everywhere (`"type": "module"`); use `import`, not `require`
- Local TS imports use `.js` suffix (e.g. `./util.js`); use `import type` for type-only imports
- Prefer `node:`-prefixed built-ins (`node:fs`, `node:path`, …)
- Naming: `camelCase` vars/functions, `PascalCase` types/classes, `SCREAMING_SNAKE_CASE` env vars
- TypeScript is `strict`; avoid `any`; validate untrusted inputs with Zod (`MessageTo.parse(...)`, route params)
- Errors: `HTTPException(status, { message })` for HTTP/auth; otherwise throw `Error` with context; prefer `log` (`server/src/util.ts`)
- Cursor/Copilot rules: none found (`.cursor/rules/`, `.cursorrules`, `.github/copilot-instructions.md`)
