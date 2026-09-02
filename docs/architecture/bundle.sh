#!/usr/bin/env sh
#
# Regenerate az-cadastre.c4 — the six source files as one document, which is
# what https://playground.likec4.dev takes. Run it after editing any of them.
#
# The order matters only for reading: a `.c4` document may hold any number of
# `specification`, `model` and `views` blocks, and references resolve across the
# whole document however it is arranged.

set -eu
cd "$(dirname "$0")"

{
  cat <<'HEADER'
// AZ-Cadastre — the whole architecture model in one file. GENERATED; DO NOT EDIT.
//
// specification.c4, system.c4, erd-cadastre-db.c4, erd-cadastre-registry.c4,
// views.c4 and po.c4, concatenated in that order and nothing else. Regenerate
// with `docs/architecture/bundle.sh` after editing any of them; edit those six,
// not this.
//
// It exists for https://playground.likec4.dev, which takes a single document:
// copy this whole file, paste it there, and all eight views are in the list.
//
// `likec4.config.json` excludes this file from the workspace — the tool would
// otherwise load both it and its six sources, and every element would be
// declared twice.
//
// https://github.com/AIShrugged/AZ-Cadastre/tree/main/docs/architecture

HEADER
  cat specification.c4 system.c4 erd-cadastre-db.c4 erd-cadastre-registry.c4 views.c4 po.c4
} > az-cadastre.c4

echo "az-cadastre.c4: $(wc -l < az-cadastre.c4) lines"
