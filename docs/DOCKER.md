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

## Archive Register Docker Build

The archive register stand-in (`apps/registry-stub`) is a **separate service**, not
part of the monolith: it stands in for a system outside this one, so it is
reached over HTTP and is allowed to be down (ADR-0009). Since ADR-0010 it also
has a database of its own.

### Building from Repository Root

```bash
docker build -f apps/registry-stub/Dockerfile -t ekalkutin/cadastre-registry:latest .
```

### It needs a database, and not the context's one

`cadastre-db` belongs to the verification context, which owns it. The register
gets `cadastre-registry` — the compose file creates it through an init script the
postgres image runs **only when it creates the data directory**, so on a volume
that already exists it has to be made by hand:

```bash
docker exec cadastre-postgres createdb -U postgres cadastre-registry
```

Then apply the schema and put the records in. Both run from inside the image —
the Prisma CLI and the migration history are in it — and either against the
running service:

```bash
docker exec cadastre-registry pnpm db:deploy   # applies the migration history
docker exec cadastre-registry pnpm db:seed     # idempotent; safe to re-run
```

or, before it is started at all, in a one-off container that never runs the
service. This is the form to use on a first deploy, and it takes the service's
own environment and network:

```bash
docker compose run --rm registry sh -c "pnpm db:deploy && pnpm db:seed"
docker compose up -d registry
```

A register whose database has no schema **starts anyway**, on purpose. It says
so at WARN, naming the command that fixes it, and answers every lookup with a
500 until somebody runs it — which the caller already treats as a register it
could not reach and reports as a property it could not confirm (ADR-0009). It
must not exit: a service that dies on the way up cannot be migrated, because
with a restart policy it crash-loops and there is no container to `docker exec`
into.

```
WARN  Register listening with no schema in its database
      {"database":"postgres:5432/cadastre-registry","apply":"pnpm db:deploy && pnpm db:seed"}
```

Once migrated it starts answering without a restart. When it is healthy the same
line is at INFO and carries the count, which is what tells a register holding
nothing under an address apart from a register holding nothing at all:

```
Register listening  {"url":"...","database":"postgres:5432/cadastre-registry","records":6}
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
- **Registry** (`ekalkutin/cadastre-registry`): the archive register stand-in on
  port 3100, answering out of its own `cadastre-registry` database
- **PostgreSQL**: two databases on port 5432 — `cadastre-db` for the
  verification context, `cadastre-registry` for the register
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

# Build the archive register stand-in
docker build -f apps/registry-stub/Dockerfile -t ekalkutin/cadastre-registry:latest .
```

### Push to Docker Hub

```bash
# Push frontend
docker push ekalkutin/cadastre-web:latest

# Push backend
docker push ekalkutin/cadastre-core:latest

# Push the archive register stand-in
docker push ekalkutin/cadastre-registry:latest
```

**Deploying the register is not only a `docker compose pull`.** The image now
expects a schema: pull it, make sure `cadastre-registry` exists, then run
`db:deploy` and `db:seed` as above. Until that is done the register starts,
answers, and reports every property as unconfirmed.

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

**The register answers `NotFound` for everything, or 500**

- Its database was never migrated, or was migrated and never seeded. Look at the
  start-up line: `docker logs cadastre-registry | grep "Register listening"`. At
  WARN with an `apply` field the schema is missing; at INFO with `"records":0`
  the schema is there and the seed was not run.
- Either way: `docker compose run --rm registry sh -c "pnpm db:deploy && pnpm db:seed"`,
  or the same two commands through `docker exec` on the running container.

**The backend reports every property as unconfirmed**

- `REGISTRY_PROVIDER` defaults to `mock` — the stand-in built into the
  verification context, which holds three demo records and never touches the
  register service. Set `REGISTRY_PROVIDER=http` and `REGISTRY_URL`. The `note`
  on every registry check says which register answered it.

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
