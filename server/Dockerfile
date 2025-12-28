FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS build
RUN --mount=source=package.json,target=package.json \
    --mount=source=bun.lock,target=bun.lock \
    bun install --frozen-lockfile

RUN --mount=source=package.json,target=package.json \
    --mount=source=bun.lock,target=bun.lock \
    --mount=source=tsconfig.json,target=tsconfig.json \
    --mount=source=src,target=src \
    bun run build

FROM base AS deploy
LABEL org.opencontainers.image.source=https://github.com/jason0x43/spellingbeeplus
LABEL org.opencontainers.image.description="A sync server for SpellingBeePlus"
LABEL org.opencontainers.image.licenses="MIT"
COPY --from=build /app/server server
COPY public public/
EXPOSE 3066
CMD [ "./server" ]
