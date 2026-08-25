# The stand-in register, as its own image. It is a separate service because
# that is what it stands in for: something outside this system, reached over
# HTTP, that can be down (ADR-0009).

FROM node:26-alpine AS builder

WORKDIR /app

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
# `prepare` hook runs husky, which belongs to a working copy and not an image.
RUN pnpm install --frozen-lockfile --prod --ignore-scripts --filter @cadastre/registry-stub...

COPY --from=builder /app/libs/matching-engine/build ./libs/matching-engine/build
COPY --from=builder /app/libs/shared/build ./libs/shared/build
COPY --from=builder /app/libs/logger/build ./libs/logger/build
COPY --from=builder /app/libs/api-contracts/build ./libs/api-contracts/build
COPY --from=builder /app/apps/registry-stub/build ./apps/registry-stub/build

WORKDIR /app/apps/registry-stub

# The records are a directory and not a bundled module on purpose: whoever is
# testing against this can mount their own over it without a rebuild.
ENV LOG_PRETTY=false
ENV REGISTRY_FIXTURES=fixtures

EXPOSE 3100

CMD ["node", "build/main.js"]
