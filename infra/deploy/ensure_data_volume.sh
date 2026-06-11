#!/bin/bash
# Runs ON the EC2 instance before the compose stack is touched. Mounts the
# persistent EBS data volume at /data and relocates Docker's state onto it via
# a /var/lib/docker -> /data/docker symlink, so Postgres/Elasticsearch/Caddy
# volumes survive instance replacement.
#
# A symlink rather than a daemon.json data-root override: Docker's local-volume
# metadata records absolute mountpoints (/var/lib/docker/volumes/...), so
# changing data-root strands every pre-existing volume. The symlink keeps all
# recorded paths valid.
#
# Idempotent: a no-op once the volume is mounted and the symlink exists.
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

if [ ! -L /var/lib/docker ]; then
  log "relocating /var/lib/docker to the data volume (stops the stack briefly)"
  systemctl stop docker docker.socket
  mkdir -p /data/docker
  # On a box half-migrated by the previous data-root version of this script,
  # /var/lib/docker is already moved aside and the data sits in /data/docker;
  # only the symlink is missing.
  if [ -d /var/lib/docker ]; then
    cp -a /var/lib/docker/. /data/docker/
    mv /var/lib/docker "/var/lib/docker.pre-data-volume.$(date -u +%s)"
  fi
  ln -s /data/docker /var/lib/docker
  # Drop the data-root override the previous version wrote; the symlink
  # supersedes it (nothing else manages daemon.json).
  if grep -qs '"data-root"' /etc/docker/daemon.json; then
    rm /etc/docker/daemon.json
  fi
  systemctl start docker
  log "Docker state now lives on /data/docker"
fi
