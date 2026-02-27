#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CF="$ROOT_DIR/scripts/cf-cli.sh"

VECTOR_INDEX="${VECTOR_INDEX:-deeplearn-index}"
PAGES_PROJECT="${PAGES_PROJECT:-gbdeeplearn}"
PAGES_BRANCH="${PAGES_BRANCH:-main}"
R2_BUCKETS=(
  "${R2_ASSETS_BUCKET:-gbdeeplearn-assets}"
  "${R2_ASSETS_PREVIEW_BUCKET:-gbdeeplearn-assets-preview}"
  "${R2_CERT_BUCKET:-gbdeeplearn-certificates}"
  "${R2_CERT_PREVIEW_BUCKET:-gbdeeplearn-certificates-preview}"
)

echo "==> Verifying Wrangler auth"
"$CF" whoami >/dev/null

echo "==> Ensuring Vectorize index: $VECTOR_INDEX"
if ! "$CF" vectorize list | grep -q "$VECTOR_INDEX"; then
  "$CF" vectorize create "$VECTOR_INDEX" --preset "@cf/baai/bge-base-en-v1.5" --description "DeepLearn platform embeddings"
else
  echo "Vectorize index already exists: $VECTOR_INDEX"
fi

echo "==> Ensuring R2 buckets"
for bucket in "${R2_BUCKETS[@]}"; do
  if ! "$CF" r2 bucket list | grep -q "$bucket"; then
    "$CF" r2 bucket create "$bucket"
  else
    echo "R2 bucket already exists: $bucket"
  fi
done

echo "==> Ensuring Pages project: $PAGES_PROJECT"
if ! "$CF" pages project list | grep -q "$PAGES_PROJECT"; then
  "$CF" pages project create "$PAGES_PROJECT" --production-branch "$PAGES_BRANCH"
else
  echo "Pages project already exists: $PAGES_PROJECT"
fi

echo "Cloudflare resource bootstrap complete."
