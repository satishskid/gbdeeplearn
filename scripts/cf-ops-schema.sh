#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
for migration in "$ROOT_DIR"/migrations/*.sql; do
  echo "Applying migration: $(basename "$migration")"
  "$ROOT_DIR/scripts/cf-cli.sh" d1 execute deeplearn-ops --remote --file "$migration"
done
