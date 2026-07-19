# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json ./


# Copy source code
COPY . .

# Build the application
RUN npm i
RUN npm run build

# Runtime stage
FROM node:22-alpine

WORKDIR /app


# Copy built application from builder
COPY --from=builder /app/build ./build

# Install a simple HTTP server
RUN npm install -g serve

# Expose port
EXPOSE 3000

# Start the application
CMD ["serve", "-s", "build", "-l", "3000"]
