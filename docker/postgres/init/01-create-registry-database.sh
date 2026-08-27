#!/bin/sh
# Two databases on one server, and never one database for two systems.
#
# `cadastre-db` belongs to the verification context, which owns it: its schema,
# its migrations, its transactions (RULE.md §3). The archive register is not a
# context and not part of the monolith — it stands in for a system outside this
# one — so it gets its own, and the boundary between a submission and the record
# of a registration stays something no join can cross (ADR-0010).
#
# The official image runs this once, when the data directory is created. On a
# volume that already exists it does not run at all, and the register's database
# has to be created by hand:
#
#   docker exec cadastre-postgres createdb -U postgres cadastre-registry
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-SQL
	SELECT 'CREATE DATABASE "cadastre-registry"'
	WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'cadastre-registry')\gexec
SQL
