#!/bin/bash
# Runs ON the EC2 instance before the compose stack is touched. Mounts the
# persistent EBS data volume at /data and points Docker's data-root at it, so
# Postgres/Elasticsearch/Caddy volumes survive instance replacement.
# Idempotent: a no-op once the volume is mounted and Docker is migrated.
set -euo pipefail

: "${DATA_VOLUME_ID:?}"

log() { echo "=== [ensure_data_volume $(date -u +%H:%M:%S)] $* ==="; }

# Nitro instances expose EBS volumes as NVMe; the volume id (sans dash) is the
# device serial, so this by-id path is stable regardless of attach order.
dev="/dev/disk/by-id/nvme-Amazon_Elastic_Block_Store_${DATA_VOLUME_ID/-/}"

for _ in $(seq 1 30); do
  [ -e "$dev" ] && break
  log "waiting for ${DATA_VOLUME_ID} to attach..."
  sleep 2
done
if [ ! -e "$dev" ]; then
  log "data volume device $dev not found"
  exit 1
fi

if ! blkid "$dev" >/dev/null; then
  log "formatting blank data volume"
  mkfs.xfs "$dev"
fi

mkdir -p /data
grep -qF "$dev" /etc/fstab || echo "$dev /data xfs defaults,nofail 0 2" >> /etc/fstab
mountpoint -q /data || mount /data

if ! grep -qs '"data-root": "/data/docker"' /etc/docker/daemon.json; then
  log "migrating Docker data-root to /data/docker (stops the stack briefly)"
  systemctl stop docker docker.socket
  mkdir -p /data/docker /etc/docker
  cp -a /var/lib/docker/. /data/docker/
  echo '{ "data-root": "/data/docker" }' > /etc/docker/daemon.json
  mv /var/lib/docker "/var/lib/docker.pre-data-volume.$(date -u +%s)"
  systemctl start docker
  log "Docker now runs from /data/docker"
fi
