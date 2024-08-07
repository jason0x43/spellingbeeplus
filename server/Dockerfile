FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base as prod-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    --mount=source=package.json,target=package.json \
    --mount=source=pnpm-lock.yaml,target=pnpm-lock.yaml \
    pnpm i --prod --frozen-lockfile

FROM base as build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    --mount=source=package.json,target=package.json \
    --mount=source=pnpm-lock.yaml,target=pnpm-lock.yaml \
    pnpm i --frozen-lockfile

RUN --mount=source=package.json,target=package.json \
    --mount=source=pnpm-lock.yaml,target=pnpm-lock.yaml \
    --mount=source=tsconfig.json,target=tsconfig.json \
    --mount=source=src,target=src \
    pnpm build

FROM node:20-slim
LABEL org.opencontainers.image.source=https://github.com/jason0x43/spellingbeeplus
LABEL org.opencontainers.image.description="A sync server for SpellingBeePlus"
LABEL org.opencontainers.image.licenses="MIT"
WORKDIR /app
COPY --from=build /app/build build/
COPY --from=prod-deps /app/node_modules node_modules/
COPY package.json .
COPY public public/
EXPOSE 3000
ENV NODE_ENV=production
CMD [ "node", "build" ]
