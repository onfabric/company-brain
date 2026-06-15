#!/usr/bin/env bash
set -euo pipefail

images=("$@")
if [ "${#images[@]}" -eq 0 ]; then
  : "${NANGO_IMAGE_URI:?}" "${BRAIN_IMAGE_URI:?}" "${PG_BACKUP_IMAGE_URI:?}"
  images=("$NANGO_IMAGE_URI" "$BRAIN_IMAGE_URI" "$PG_BACKUP_IMAGE_URI")
fi

docker_config="$(mktemp -d)"
trap 'rm -rf "$docker_config"' EXIT
export DOCKER_CONFIG="$docker_config"

failed=0
for image in "${images[@]}"; do
  for attempt in $(seq 1 12); do
    if docker manifest inspect "$image" >/dev/null 2>&1; then
      echo "Public pull check passed: $image"
      continue 2
    fi

    echo "Waiting for anonymous pull access: $image ($attempt/12)"
    sleep 10
  done

  failed=1
  if [ "${GITHUB_ACTIONS:-}" = "true" ]; then
    echo "::error title=GHCR package is not public::$image cannot be pulled anonymously. Make the GHCR package public, then rerun this workflow."
  else
    echo "Error: $image cannot be pulled anonymously." >&2
  fi
done

if [ "$failed" -ne 0 ]; then
  {
    echo
    echo "Company Brain release images must be public because installed CLIs and EC2 hosts pull them without registry credentials."
    echo "Check the package settings under https://github.com/orgs/onfabric/packages and set each Company Brain container package visibility to Public."
  } >&2
  exit 1
fi
