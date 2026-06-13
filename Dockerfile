# syntax=docker/dockerfile:1-labs

# Monorepo image builder; context must be the repo root. Builds two images via
# `--target`: the brain (default final stage) and the logto-setup provisioner,
# which share the bun base stage so the version is pinned once.
#   docker build -t company-brain/brain .
#   docker build --target logto-setup -t company-brain/logto-setup .

# Single source of truth for the bun base version across both images.
# When updating, update it also in .bun-version and mise.toml.
FROM oven/bun:1.3.14-slim AS base
WORKDIR /monorepo

# logto-setup provisioner: shares the bun base so the version is pinned once.
# No runtime deps, so it skips the install/build stages entirely.
FROM base AS logto-setup
WORKDIR /app
COPY logto-setup/src ./src
ENTRYPOINT ["bun", "run", "src/configure.ts"]

# Cache deps in a temp directory. Copy only the workspace manifests + lockfile
# so this layer is reused whenever source changes but dependencies don't.
FROM base AS install
WORKDIR /temp/deps
COPY package.json bun.lock ./
COPY --parents agent-sync/package.json backend/package.json dashboard/package.json logto-setup/package.json nango-integrations/package.json ./
RUN bun install --frozen-lockfile

FROM base AS build
COPY --from=install /temp/deps ./
COPY backend backend
COPY dashboard dashboard
WORKDIR /monorepo/backend
ENV NODE_ENV=production
RUN bun run build

# Distroless `:debug` for the bundled busybox (wget) used by HEALTHCHECK.
FROM gcr.io/distroless/base-debian12:debug AS release
WORKDIR /app
COPY --from=build /monorepo/backend/dist/ ./
ENV NODE_ENV=production
EXPOSE 3010/tcp
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["/busybox/wget", "-q", "--spider", "http://localhost:3010/health"]
ENTRYPOINT ["/app/server"]
