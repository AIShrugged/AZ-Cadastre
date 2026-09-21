#!/bin/sh
# Applies the pending migrations of the databases, and nothing else.
#
# The three histories are separate on purpose — the register's because it stands
# in for a system outside this one (ADR-0010), the accounts context's because a
# context owns its database (ADR-0029) — and none of them is ever applied to
# another's database, so each reads its own variable. There is deliberately no
# fallback to a bare `DATABASE_URL`: this image talks to three databases, and a
# single unnamed URL is exactly the mistake that puts one context's tables in
# another's.
#
#   migrate                 # all three, in order
#   migrate core            # cadastre-db       — CORE_DATABASE_URL
#   migrate accounts        # cadastre-accounts — ACCOUNTS_DATABASE_URL
#   migrate registry        # cadastre-registry — REGISTRY_DATABASE_URL
#   migrate status          # report what is pending, apply nothing
#
# `reset` is not a verb here and never will be: this image is pointed at
# production databases, and `migrate reset` drops them.

set -eu

CORE_DIR='packages/verification'
ACCOUNTS_DIR='packages/accounts'
REGISTRY_DIR='apps/registry-stub'

# Asked for, or told off: `migrate --help` is a request and exits 0, a bad
# target is a mistake and exits 64 (EX_USAGE).
usage() {
  cat >&2 <<'USAGE'
usage: migrate [core|accounts|registry|status]

  (no argument)  apply pending migrations to every database
  core           apply to cadastre-db only         (CORE_DATABASE_URL)
  accounts       apply to cadastre-accounts only   (ACCOUNTS_DATABASE_URL)
  registry       apply to cadastre-registry only   (REGISTRY_DATABASE_URL)
  status         report what is pending for each, apply nothing
USAGE
  exit "${1-64}"
}

# The URL for a target, or a message naming the variable that is missing. The
# name is the whole of the fix, so it is in the error rather than in a doc.
url_for() {
  case "$1" in
    core) printf '%s' "${CORE_DATABASE_URL:?CORE_DATABASE_URL is not set — the URL of the cadastre-db database}" ;;
    accounts) printf '%s' "${ACCOUNTS_DATABASE_URL:?ACCOUNTS_DATABASE_URL is not set — the URL of the cadastre-accounts database}" ;;
    registry) printf '%s' "${REGISTRY_DATABASE_URL:?REGISTRY_DATABASE_URL is not set — the URL of the cadastre-registry database}" ;;
  esac
}

dir_for() {
  case "$1" in
    core) printf '%s' "$CORE_DIR" ;;
    accounts) printf '%s' "$ACCOUNTS_DIR" ;;
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
    run accounts migrate deploy
    run registry migrate deploy
    ;;
  core | accounts | registry)
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
    run accounts migrate status || reported=1
    run registry migrate status || reported=1
    exit "$reported"
    ;;
  -h | --help | help) usage 0 ;;
  *)
    echo "migrate: unknown target '$1'" >&2
    usage
    ;;
esac
