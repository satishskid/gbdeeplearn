#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

"$ROOT_DIR/scripts/cf-cli.sh" d1 execute deeplearn-ops --remote --file "$ROOT_DIR/migrations/0001_platform_ops.sql"
