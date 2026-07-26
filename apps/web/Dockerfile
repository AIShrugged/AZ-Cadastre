# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy packages needed for build
COPY apps/web ./apps/web
COPY libs/contracts ./libs/contracts

# Install pnpm and dependencies
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

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
