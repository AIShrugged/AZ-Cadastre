# Migrations are applied by an image of their own

Date: 2026-09-09. Status: accepted.

## Context

The stand runs three published images and two databases: `cadastre-core` reads
`cadastre-db`, whose schema and migration history belong to
`packages/verification`, and `cadastre-registry` reads `cadastre-registry`,
whose own history belongs to `apps/registry-stub` (ADR-0010). Neither database
had a working way to be migrated from what is published, and both the compose
file and `docs/DOCKER.md` documented a command that has never run:

```
$ docker exec cadastre-registry pnpm db:deploy
$ prisma migrate deploy
sh: prisma: not found
[ELIFECYCLE] Command failed.
```

`prisma` is a devDependency of both `packages/verification` and
`apps/registry-stub`, and both runtime stages install with
`pnpm install --frozen-lockfile --prod --ignore-scripts`. The CLI is not in the
images, and neither is the schema engine binary that `--ignore-scripts` would
have kept out anyway.

The same command against `cadastre-core` fails one step earlier and for a
second reason:

```
$ docker exec cadastre-core sh -c 'cd /app/packages/verification && pnpm db:deploy'
[ERR_PNPM_WORKSPACE_PKG_NOT_FOUND] In ../../apps/server: "@cadastre/registry-stub@workspace:*"
is in the dependencies but no package named "@cadastre/registry-stub" is present in the workspace
```

That image carries no `apps/registry-stub` — `apps/server` names it only as a
devDependency, so the Dockerfile has no reason to copy it — which makes the
workspace look stale to pnpm, and pnpm tries to reinstall it before running any
script. There is also no `db:deploy` in `apps/server` at all: the script lives
in `packages/verification`, where the schema is. So the documented command was
not one command with one bug; it was two different commands, each broken
differently, for two services.

The workaround in use, `pnpm dlx --allow-build=@prisma/engines prisma@7 migrate
deploy`, works and downloads ~130 MB of CLI and a 22 MB engine from the public
registry on every migration — a dependency on npm's availability at the exact
moment a deploy is half done.

## Decision

Migrations are applied by a fourth published image, `cadastre-migrator`, built
from `docker/migrator/Dockerfile`. It holds the Prisma CLI, both schemas, both
migration histories and nothing that serves traffic. Its entrypoint takes a
target and nothing else:

```
migrate                 # both databases, in order
migrate core            # cadastre-db       — CORE_DATABASE_URL
migrate registry        # cadastre-registry — REGISTRY_DATABASE_URL
migrate status          # report what is pending, apply nothing
```

`docker-compose.yml` carries it as a service behind the `migrate` profile, so
`docker compose up` never starts it and `docker compose run --rm migrate`
supplies the network and both URLs:

```
docker compose run --rm migrate
```

The CLI version is read out of `pnpm-lock.yaml` at build time rather than
written in the Dockerfile — the CLI that applies a history should be the version
the history was written with, and a second place to write `7.9.0` is a second
place to forget it. `@prisma/engines` downloads the schema engine during that
build, which is the only moment anything reaches the network: applying a
migration on the stand needs no registry and no proxy.

It is released by the same workflow, in the same matrix, as the three service
images. A `latest` migrator older than the `latest` service it migrates for is a
schema that does not match the code reading it.

## What was rejected, and why

**Move `prisma` into `dependencies`.** One line, and `pnpm db:deploy` starts
working in `cadastre-registry`. It also puts `migrate reset` — which drops the
database — inside a container that is exposed to the internet and that anyone
with `docker exec` can reach, and it drags the CLI's own dependency tree in
with it: `@prisma/dev`, a bundled Prisma Studio and a MySQL driver, about
130 MB of database GUI per image, for a command that runs once per deploy. It
also does not fix `cadastre-core`, where the failure is pnpm's workspace check
and not the missing binary.

**Migrate when the container starts.** Nothing to remember and nothing to run.
Two containers booting into the same database race for it, and a stand rolled
back by pulling the previous tag migrates itself forward on the way there —
`migrate deploy` only ever goes forwards. A migration is something done to a
database before the service that reads it starts, not something the service does
on its way up.

**Reimplement `migrate deploy` over the `pg` driver that is already in both
images.** The migrations are plain SQL and `_prisma_migrations` is a small
table, so this is a hundred lines and no new image. It is also a private
contract of Prisma's, maintained by us, and the first checksum or
partially-applied-migration case it gets wrong is a production database in a
state Prisma will not touch afterwards.

## Consequences

- A fourth image to build, push and pull. `docker compose pull` takes it along
  with the rest, so the operator's routine does not grow a step; the release
  matrix does.
- Migrating is now the same command for both databases —
  `docker compose run --rm migrate` — which is what it was not before. The
  asymmetry the old instructions carried (`db:deploy` exists in
  `packages/verification`, not in `apps/server`) stops being anybody's problem
  because the pnpm path is no longer the production path.
- `db:reset` stays a development script. It is unreachable from the service
  images, which have no CLI, and from the migrator, which ships no `pnpm` and
  has no `reset` verb. Overriding the migrator's entrypoint to reach the CLI
  directly is still possible; it is no longer something a tired hand does by
  accident.
- Seeding the register is still `pnpm db:seed` from `cadastre-registry`: it is
  `node build/…/seed.js`, needs no CLI, and needs the register's compiled code,
  which the migrator deliberately does not carry.
