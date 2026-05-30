#!/usr/bin/env sh
# Prepare generated artifacts once, then run the given command with artifact
# preparation skipped so downstream turbo tasks (and the docs sync step) do not
# rebuild them again. This replaces the `pnpm run prepare:artifacts &&
# DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 <cmd>` prelude that was duplicated across the
# root scripts. prepare:artifacts intentionally runs with the skip flag UNSET so
# library/docs artifacts are actually (re)built before the command runs.
set -e

pnpm run prepare:artifacts
DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 exec "$@"
