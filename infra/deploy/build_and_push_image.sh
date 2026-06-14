#!/usr/bin/env bash
set -euo pipefail

: "${ECR_REPOSITORY_URL:?}" "${IMAGE_TAG:?}" "${BUILD_CONTEXT:?}" "${DOCKERFILE:?}"

PLATFORM="${PLATFORM:-linux/amd64}"
LATEST_TAG="${LATEST_TAG:-latest}"
SOURCE_LABEL="${SOURCE_LABEL:-https://github.com/onfabric/company-brain}"
CACHE_SCOPE="${CACHE_SCOPE:-}"
CACHE_FROM="${CACHE_FROM:-}"
CACHE_TO="${CACHE_TO:-}"

image_uri="${ECR_REPOSITORY_URL}:${IMAGE_TAG}"
latest_uri="${ECR_REPOSITORY_URL}:${LATEST_TAG}"

cmd=(
  docker buildx build
  --platform "$PLATFORM"
  --push
  --tag "$image_uri"
  --tag "$latest_uri"
  --label "org.opencontainers.image.source=$SOURCE_LABEL"
  --file "$DOCKERFILE"
)

if [ -n "$CACHE_SCOPE" ]; then
  cmd+=(--label "company-brain.cache-scope=$CACHE_SCOPE")
fi
if [ -n "$CACHE_FROM" ]; then
  cmd+=(--cache-from "$CACHE_FROM")
fi
if [ -n "$CACHE_TO" ]; then
  cmd+=(--cache-to "$CACHE_TO")
fi

cmd+=("$BUILD_CONTEXT")

printf '$'
printf ' %q' "${cmd[@]}"
printf '\n'
"${cmd[@]}"
