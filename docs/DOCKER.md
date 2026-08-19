# Docker Setup

## Frontend Docker Build

The frontend is containerized with a multi-stage build using Node.js for compilation and Nginx for serving.

### Building from Repository Root

**Build the frontend image:**

```bash
docker build -f apps/web/Dockerfile -t frontend-app .
```

**Important:** Always build from the **monorepo root directory**, not from `apps/web/`. The Dockerfile references workspace files and other packages at the root level.

### Running the Container

**Start the container:**

```bash
docker run -p 80:3000 frontend-app
```

Then access the application at `http://localhost`

**With port mapping:**

```bash
docker run -p 8080:80 frontend-app
```

Access at `http://localhost:8080`

**With interactive terminal:**

```bash
docker run -it -p 80:3000 frontend-app
```

## Backend Docker Build

The backend (NestJS) is containerized with a multi-stage build using Node.js for compilation and running.

### Building from Repository Root

**Build the backend image:**

```bash
docker build -f apps/server/Dockerfile -t server-app .
```

**Important:** Always build from the **monorepo root directory**, not from `apps/server/`.

### Running the Container

**Start the container:**

```bash
docker run -p 3000:3000 core-app
```

Then access the API at `http://localhost:3000`

**With port mapping:**

```bash
docker run -p 3001:3000 core-app
```

Access at `http://localhost:3001`

**With environment variables:**

```bash
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:password@host:5432/cadastre" \
  core-app
```

**With interactive terminal:**

```bash
docker run -it -p 3000:3000 core-app
```

### Docker Compose

The `docker-compose.yml` in the repository root includes all services needed to run the full application stack.

**Run the full stack with pre-built images:**

```bash
docker compose up
```

**Run with local builds (for development):**

```bash
docker compose up --build
```

The docker-compose configuration includes:

- **Frontend** (`ekalkutin/cadastre-web`): Nginx serving the React app on port 80
- **Backend** (`ekalkutin/cadastre-core`): NestJS API on port 3000
- **PostgreSQL**: Database on port 5432
- **RustFS**: S3-compatible storage on ports 9000/9001

**Access services:**

- Frontend: `http://localhost`
- Backend API: `http://localhost:3000`
- PostgreSQL: `localhost:5432` (credentials: postgres/postgres)
- RustFS Console: `http://localhost:9001`
- RustFS S3 API: `http://localhost:9000`

**Pull latest images:**

```bash
docker compose pull
```

**Stop all services:**

```bash
docker compose down
```

**View logs:**

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f postgres
```

### What's Inside

**Frontend Build Stage:**

- Node 20 Alpine image
- Installs pnpm from workspace root
- Resolves dependencies with `pnpm install --frozen-lockfile`
- Builds Vite app with `pnpm build`

**Frontend Runtime Stage:**

- Nginx Alpine image
- Copies built assets to `/usr/share/nginx/html`
- Serves on port 80
- Includes gzip compression and cache headers

**Backend Build Stage:**

- Node 20 Alpine image
- Installs pnpm and all dependencies
- Runs Prisma code generation
- Builds NestJS app with `nest build`

**Backend Runtime Stage:**

- Node 20 Alpine image
- Copies built application and production dependencies
- Includes Prisma schema for database operations
- Runs compiled NestJS application on port 3000

## Building and Pushing Images

### Build Locally

From the repository root:

```bash
# Build frontend
docker build -f apps/web/Dockerfile -t ekalkutin/cadastre-web:latest .

# Build backend
docker build -f apps/server/Dockerfile -t ekalkutin/cadastre-core:latest .
```

### Push to Docker Hub

```bash
# Push frontend
docker push ekalkutin/cadastre-web:latest

# Push backend
docker push ekalkutin/cadastre-core:latest
```

### Tag with Version

```bash
# Build and tag with version
docker build -f apps/web/Dockerfile -t ekalkutin/cadastre-web:v1.0.0 .
docker tag ekalkutin/cadastre-web:v1.0.0 ekalkutin/cadastre-web:latest

# Push versioned image
docker push ekalkutin/cadastre-web:v1.0.0
docker push ekalkutin/cadastre-web:latest
```

### Troubleshooting

**"COPY failed: file not found"**

- Ensure you're running `docker build` from the **monorepo root**, not from `apps/web/` or `apps/server/`

**Large image size**

- The build uses a multi-stage approach to minimize runtime size
- Frontend final image contains only Nginx + built assets
- Backend final image contains Node + compiled app + dependencies

**Nginx not serving requests**

- Check that port 80 is available or use different port mapping with `-p`

**Backend won't start**

- Verify DATABASE_URL environment variable is set
- Ensure PostgreSQL database is accessible
- Check logs: `docker logs core-app`

**Database connection issues**

- Verify credentials in `docker-compose.yml`
- Ensure PostgreSQL container is running: `docker compose ps`
- Check port 5432 is accessible or not already in use

**CORS errors (405 Not Allowed, preflight failures)**

The backend CORS must be configured to match your frontend URL. In `docker-compose.yml`, ensure:

```yaml
backend:
  environment:
    - WEB_ORIGIN=http://localhost # Match your frontend URL
    - S3_ENDPOINT=http://localhost:9000 # RustFS endpoint
```

- If frontend is at `http://localhost:80` → set `WEB_ORIGIN=http://localhost`
- If frontend is at `http://localhost:8080` → set `WEB_ORIGIN=http://localhost:8080`
- If frontend is at `https://example.com` → set `WEB_ORIGIN=https://example.com`

The `S3_ENDPOINT` must also be reachable from the browser for presigned upload URLs to work.

**Check backend CORS logs:**

```bash
docker logs cadastre-backend
```

**Test presign endpoint:**

```bash
curl -X POST http://localhost:3000/api/documents/presign \
  -H "Origin: http://localhost" \
  -H "Content-Type: application/json" \
  -d '{"filename": "test.pdf"}'
```
