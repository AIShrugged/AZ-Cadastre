# The migrator: the Prisma CLI, both schemas and both migration histories, and
# nothing that serves traffic.
#
# It exists because the runtime images cannot carry the CLI. `prisma` is a
# devDependency of both `packages/verification` and `apps/registry-stub`, and
# both runtime stages install with `--prod`, so `pnpm db:deploy` inside
# `cadastre-registry` answers `sh: prisma: not found`. Inside `cadastre-core` it
# does not even reach Prisma: that image holds no `apps/registry-stub`, which
# `apps/server` names as a devDependency, so pnpm decides the workspace is stale
# and dies re-installing it.
#
# Moving `prisma` into `dependencies` would fix the message and cost more than
# it looks: the CLI drags in @prisma/dev, a bundled Prisma Studio and a MySQL
# driver — ~130 MB of database GUI in a container that is exposed to the
# internet — and it puts `migrate reset` one typo away from the production
# database. Migrating is not something the service does; it is something done to
# the service's database, before it starts. So it is its own image, it holds
# only what applying a migration needs, and it exits when it is finished.
#
# Deliberately NOT run on start-up: two replicas booting together would race for
# the same database, and a stand that is rolled back by pulling the previous tag
# would silently migrate forward on the way there.

FROM node:26-alpine

WORKDIR /app

# The CLI that applies a migration history should be the version the history was
# written with, so the version is read out of the lockfile rather than written
# here — a second place to write `7.9.0` is a second place to forget it. `npm`
# rather than `pnpm`: nothing here is a workspace member, and the CLI is the
# whole dependency tree.
#
# This is also the only moment anything reaches the network: `@prisma/engines`
# downloads the schema-engine binary in its postinstall, and it is baked into
# the image here so that applying a migration on the stand needs no registry,
# no proxy and no `pnpm dlx`.
COPY pnpm-lock.yaml ./
RUN PRISMA_VERSION="$(sed -n 's/^  prisma@\([0-9][^:(]*\):$/\1/p' pnpm-lock.yaml | head -n1)" \
 && test -n "$PRISMA_VERSION" \
 && echo "Prisma CLI from the lockfile: $PRISMA_VERSION" \
 && npm install --no-save --no-audit --no-fund "prisma@$PRISMA_VERSION" \
 && npm cache clean --force \
 && rm pnpm-lock.yaml

# The solution file and the base config travel together for the reason the
# service images give: a `prisma.config.ts` is loaded through the project's own
# tsconfig, and without the base it stops at "File '../../tsconfig.base.json'
# not found".
COPY tsconfig.json tsconfig.base.json ./

# Both contexts, each with its own `prisma.config.ts`, its own schema and its
# own migration history. They are copied whole — a few megabytes of source — so
# that the config resolves exactly the paths it resolves in a working copy, and
# so a new file under `persistence/` does not need a line added here.
COPY packages/verification ./packages/verification
COPY apps/registry-stub ./apps/registry-stub

COPY docker/migrator/migrate.sh /usr/local/bin/migrate
RUN chmod +x /usr/local/bin/migrate

# No CMD past the default: `docker compose run --rm migrate` applies both
# databases, and a target after it narrows to one.
ENTRYPOINT ["/usr/local/bin/migrate"]
