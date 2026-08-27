# Build stage
#
# Node 22 was already the floor: pdf.js renders PDF pages through APIs older
# runtimes do not have, and on Node 20 it draws every page blank without
# failing. pnpm 11 raised it again — it reads `node:sqlite`, which Node 20 does
# not have either. 26 is the current line, and what the repo types against.
FROM node:26-alpine AS builder

WORKDIR /app

# Root workspace config
# tsconfig.base.json travels with the solution file: every package extends it,
# and `prisma generate` loads prisma.config.ts through the context's own
# tsconfig — without the base it stops at "File '../../tsconfig.base.json'
# not found" during install, long before anything is compiled.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json tsconfig.base.json ./

# The composition root, the contexts it mounts, and the packages those build on
COPY apps/server ./apps/server
COPY libs ./libs
COPY packages ./packages

RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Packages build in dependency order: the kernel and the contracts first, then
# the adapters and the edge, then the context, then the app that mounts them.
RUN pnpm -r build

# Runtime stage
FROM node:26-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json tsconfig.base.json ./
COPY apps/server ./apps/server
COPY libs ./libs
COPY packages ./packages

RUN npm install -g pnpm

# --ignore-scripts: every install hook in this repo belongs to development, not
# to the image. The root `prepare` runs husky, which `--prod` has just excluded
# — the install died on `husky: not found` — and the context's `postinstall`
# runs `prisma generate`, whose output is already here: the `prisma-client`
# generator emits into `src/`, so it arrives compiled in the `build/` copied
# from the builder, and the pg driver adapter needs no engine binary.
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Compiled output for every workspace package
COPY --from=builder /app/apps/server/build ./apps/server/build
COPY --from=builder /app/libs/shared/build ./libs/shared/build
COPY --from=builder /app/libs/event-publisher/build ./libs/event-publisher/build
COPY --from=builder /app/libs/logger/build ./libs/logger/build
COPY --from=builder /app/libs/api-contracts/build ./libs/api-contracts/build
COPY --from=builder /app/libs/api-gateway/build ./libs/api-gateway/build
COPY --from=builder /app/packages/verification/build ./packages/verification/build

# The verification context owns its schema and migration history; `db:deploy`
# is run against them from that package.
COPY --from=builder /app/packages/verification/src/infrastructure/persistence/schema \
     ./packages/verification/src/infrastructure/persistence/schema
COPY --from=builder /app/packages/verification/src/infrastructure/persistence/migrations \
     ./packages/verification/src/infrastructure/persistence/migrations

WORKDIR /app/apps/server

# One JSON object per line rather than colour and indentation: in a container
# the reader is a log collector, not a terminal (ADR-0008).
ENV LOG_PRETTY=false

EXPOSE 3000

CMD ["node", "build/main.js"]
