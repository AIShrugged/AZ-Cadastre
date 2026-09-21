#!/bin/sh
# One database per owner, and never one database for two systems.
#
# `cadastre-db` belongs to the verification context, which owns it: its schema,
# its migrations, its transactions (RULE.md §3). `cadastre-accounts` belongs to
# the accounts context for the same reason (ADR-0029) — two contexts on one
# database is how a join across the boundary gets written by accident. The
# archive register is not a context and not part of the monolith — it stands in
# for a system outside this one — so it gets its own too, and the boundary
# between a submission and the record of a registration stays something no join
# can cross (ADR-0010).
#
# The official image runs this once, when the data directory is created. On a
# volume that already exists it does not run at all, and the databases have to
# be created by hand:
#
#   docker exec cadastre-postgres createdb -U postgres cadastre-accounts
#   docker exec cadastre-postgres createdb -U postgres cadastre-registry
set -e

for database in cadastre-accounts cadastre-registry; do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" -v db="$database" <<-SQL
	SELECT format('CREATE DATABASE %I', :'db')
	WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'db')\gexec
	SQL
done
