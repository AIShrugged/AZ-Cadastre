#!/bin/sh
# Applies the pending migrations of one or both databases, and nothing else.
#
# The two histories are separate on purpose (ADR-0010) and are never applied to
# the same database, so each one reads its own variable. There is deliberately
# no fallback to a bare `DATABASE_URL`: this image talks to two databases, and a
# single unnamed URL is exactly the mistake that puts the register's tables in
# the verification context's database.
#
#   migrate                 # both, in order
#   migrate core            # cadastre-db      — CORE_DATABASE_URL
#   migrate registry        # cadastre-registry — REGISTRY_DATABASE_URL
#   migrate status          # report what is pending, apply nothing
#
# `reset` is not a verb here and never will be: this image is pointed at
# production databases, and `migrate reset` drops them.

set -eu

CORE_DIR='packages/verification'
REGISTRY_DIR='apps/registry-stub'

# Asked for, or told off: `migrate --help` is a request and exits 0, a bad
# target is a mistake and exits 64 (EX_USAGE).
usage() {
  cat >&2 <<'USAGE'
usage: migrate [core|registry|status]

  (no argument)  apply pending migrations to both databases
  core           apply to cadastre-db only        (CORE_DATABASE_URL)
  registry       apply to cadastre-registry only  (REGISTRY_DATABASE_URL)
  status         report what is pending for both, apply nothing
USAGE
  exit "${1-64}"
}

# The URL for a target, or a message naming the variable that is missing. The
# name is the whole of the fix, so it is in the error rather than in a doc.
url_for() {
  case "$1" in
    core) printf '%s' "${CORE_DATABASE_URL:?CORE_DATABASE_URL is not set — the URL of the cadastre-db database}" ;;
    registry) printf '%s' "${REGISTRY_DATABASE_URL:?REGISTRY_DATABASE_URL is not set — the URL of the cadastre-registry database}" ;;
  esac
}

dir_for() {
  case "$1" in
    core) printf '%s' "$CORE_DIR" ;;
    registry) printf '%s' "$REGISTRY_DIR" ;;
  esac
}

# The database, never the credentials in front of it — the same rule the
# register's start-up line follows, and for the same reason: this output ends up
# in a deployment log.
named() {
  # The query string goes first so that the last `@` left in the line is the
  # one closing the credentials, and the greedy match cannot stop inside a
  # password that happens to contain a slash.
  printf '%s' "$1" | sed -e 's|?.*$||' -e 's|^[a-zA-Z0-9+.-]*://||' -e 's|^.*@||'
}

run() { # run <target> <prisma subcommand...>
  target="$1"
  shift

  url="$(url_for "$target")"
  dir="$(dir_for "$target")"

  echo "==> $target  $(named "$url")"
  # `cd` per target: `prisma.config.ts` resolves its schema and its migrations
  # relative to itself, and the config is what carries the datasource URL in
  # Prisma 7 — which is why the URL is exported rather than passed as a flag.
  (
    cd "$dir"
    DATABASE_URL="$url"
    export DATABASE_URL
    exec /app/node_modules/.bin/prisma "$@"
  )
}

case "${1-}" in
  '')
    run core migrate deploy
    run registry migrate deploy
    ;;
  core | registry)
    [ "$#" -eq 1 ] || usage
    run "$1" migrate deploy
    ;;
  status)
    [ "$#" -eq 1 ] || usage
    # Both are reported even when the first has something pending — `migrate
    # status` exits 1 in exactly that case, and stopping there would hide the
    # half of the answer the reader came for.
    reported=0
    run core migrate status || reported=1
    run registry migrate status || reported=1
    exit "$reported"
    ;;
  -h | --help | help) usage 0 ;;
  *)
    echo "migrate: unknown target '$1'" >&2
    usage
    ;;
esac
