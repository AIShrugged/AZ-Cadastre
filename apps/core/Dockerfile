# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Root workspace config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./

# The composition root, the contexts it mounts, and the packages those build on
COPY apps/core ./apps/core
COPY libs ./libs

RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Packages build in dependency order: kernel and contracts first, then the
# shared application machinery, then the context, then the app that mounts it.
RUN pnpm -r build

# Runtime stage
FROM node:20-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY apps/core ./apps/core
COPY libs ./libs

RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile --prod

# Compiled output for every workspace package
COPY --from=builder /app/apps/core/build ./apps/core/build
COPY --from=builder /app/libs/shared/kernel/build ./libs/shared/kernel/build
COPY --from=builder /app/libs/shared/application/build ./libs/shared/application/build
COPY --from=builder /app/libs/contracts/build ./libs/contracts/build
COPY --from=builder /app/libs/contexts/verification/build ./libs/contexts/verification/build

# The verification context owns its schema and migration history; `db:deploy`
# is run against them from that package.
COPY --from=builder /app/libs/contexts/verification/src/infrastructure/persistence/schema \
     ./libs/contexts/verification/src/infrastructure/persistence/schema
COPY --from=builder /app/libs/contexts/verification/src/infrastructure/persistence/migrations \
     ./libs/contexts/verification/src/infrastructure/persistence/migrations

WORKDIR /app/apps/core

EXPOSE 3000

CMD ["node", "build/main.js"]
