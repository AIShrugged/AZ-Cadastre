# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace config and TypeScript config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./

# Copy packages needed for build
COPY apps/core ./apps/core
COPY libs/contracts ./libs/contracts

# Install pnpm and dependencies
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Build the backend
WORKDIR /app/apps/core
RUN pnpm build

# Runtime stage
FROM node:20-alpine

WORKDIR /app

# Copy root workspace config and TypeScript config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./

# Copy packages for runtime
COPY apps/core ./apps/core
COPY libs/contracts ./libs/contracts

# Install pnpm and production dependencies only
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile --prod

# Copy built application from builder
COPY --from=builder /app/apps/core/build ./apps/core/build
COPY --from=builder /app/apps/core/node_modules ./apps/core/node_modules

# Prisma
COPY --from=builder /app/apps/core/prisma ./apps/core/prisma

WORKDIR /app/apps/core

EXPOSE 3000

CMD ["node", "build/main.js"]
