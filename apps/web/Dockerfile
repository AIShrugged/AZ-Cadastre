# Build stage
#
# Node 22 at the least: pnpm 11 reads `node:sqlite`, which Node 20 does not have,
# and the install dies with ERR_UNKNOWN_BUILTIN_MODULE before resolving anything.
# Kept on the same line as the server image so one runtime answers for both.
FROM node:26-alpine AS builder

WORKDIR /app

# Root workspace config. tsconfig.base.json comes with it because the contracts
# package extends it, and it is built here rather than copied in.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./

# The app, and the one package it imports
COPY apps/web ./apps/web
COPY libs/api-contracts ./libs/api-contracts

# Install pnpm and dependencies
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# The contracts before the app that imports them: the web app resolves
# `@cadastre/api-contracts` to its `build/` and not its source (ADR-0006), and
# .dockerignore keeps the host's build/ out of the context on purpose — what
# ships is compiled here, never whatever happened to be lying around.
RUN pnpm --filter @cadastre/api-contracts build

# Build the frontend
WORKDIR /app/apps/web
RUN pnpm build

# Runtime stage
FROM nginx:alpine

# Copy built app to nginx
COPY --from=builder /app/apps/web/build /usr/share/nginx/html

# Copy nginx config
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
