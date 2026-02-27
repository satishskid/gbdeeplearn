#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export WRANGLER_LOG_PATH="${WRANGLER_LOG_PATH:-$ROOT_DIR/.wrangler/logs}"
export CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-9f4998a66a5d7bd7a230d0222544fbe6}"
mkdir -p "$WRANGLER_LOG_PATH"

exec npx wrangler "$@"
