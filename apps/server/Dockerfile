# Build stage
#
# Node 22 at the least: pdf.js renders PDF pages through APIs older runtimes do
# not have, and on Node 20 it draws every page blank without failing.
FROM node:22-alpine AS builder

WORKDIR /app

# Root workspace config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./

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
FROM node:22-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY apps/server ./apps/server
COPY libs ./libs
COPY packages ./packages

RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile --prod

# Compiled output for every workspace package
COPY --from=builder /app/apps/server/build ./apps/server/build
COPY --from=builder /app/libs/shared/build ./libs/shared/build
COPY --from=builder /app/libs/event-publisher/build ./libs/event-publisher/build
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

EXPOSE 3000

CMD ["node", "build/main.js"]
