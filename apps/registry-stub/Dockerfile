# The stand-in register, as its own image. It is a separate service because
# that is what it stands in for: something outside this system, reached over
# HTTP, that can be down (ADR-0009) — and, since it got a database of its own,
# something with its own schema and its own migration history (ADR-0010).

FROM node:26-alpine AS builder

WORKDIR /app

# tsconfig.base.json travels with the solution file for the reason the server
# image says: `prisma generate` loads prisma.config.ts through this project's
# own tsconfig, and without the base it stops during install.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json tsconfig.base.json ./

COPY apps/registry-stub ./apps/registry-stub
COPY libs ./libs

RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile --filter @cadastre/registry-stub...
RUN pnpm --filter @cadastre/registry-stub... build

FROM node:26-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json tsconfig.base.json ./
COPY apps/registry-stub ./apps/registry-stub
COPY libs ./libs

RUN npm install -g pnpm

# --ignore-scripts for the same reason the server image does it: the root
# `prepare` hook runs husky, which belongs to a working copy and not an image,
# and this project's `postinstall` runs `prisma generate`, whose output is
# already here — the `prisma-client` generator emits into `src/`, so it arrives
# compiled in the `build/` copied below.
RUN pnpm install --frozen-lockfile --prod --ignore-scripts --filter @cadastre/registry-stub...

COPY --from=builder /app/libs/matching-engine/build ./libs/matching-engine/build
COPY --from=builder /app/libs/shared/build ./libs/shared/build
COPY --from=builder /app/libs/logger/build ./libs/logger/build
COPY --from=builder /app/libs/api-contracts/build ./libs/api-contracts/build
COPY --from=builder /app/apps/registry-stub/build ./apps/registry-stub/build

# The register owns its schema and migration history, and `db:deploy` is run
# against them from here — the same arrangement the verification context has,
# and the reason the two can never be applied to one database by accident.
COPY --from=builder /app/apps/registry-stub/src/infrastructure/persistence/schema \
     ./apps/registry-stub/src/infrastructure/persistence/schema
COPY --from=builder /app/apps/registry-stub/src/infrastructure/persistence/migrations \
     ./apps/registry-stub/src/infrastructure/persistence/migrations

WORKDIR /app/apps/registry-stub

ENV LOG_PRETTY=false

EXPOSE 3100

CMD ["node", "build/main.js"]
