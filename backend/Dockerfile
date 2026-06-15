# syntax=docker/dockerfile:1-labs

# Build context must be the monorepo root. Build from the monorepo root with:
#   docker build -f backend/Dockerfile -t company-brain/brain .

FROM oven/bun:1.3.14-slim AS base
WORKDIR /monorepo

# Assemble just the manifests + lockfile for the workspaces declared in the root
# package.json, so the install layer below busts only when dependencies change.
FROM base AS prune
COPY . .
RUN <<'EOF'
set -e
mkdir -p out
cp package.json bun.lock out/
for pkg in $(bun -e 'console.log((await Bun.file("package.json").json()).workspaces.packages.join(" "))'); do
  mkdir -p "out/$pkg"
  cp "$pkg/package.json" "out/$pkg/package.json"
done
EOF

FROM base AS install
WORKDIR /temp/deps
COPY --from=prune /monorepo/out/ ./
RUN bun install --frozen-lockfile

FROM base AS build
COPY --from=install /temp/deps ./
COPY backend-client backend-client
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
  CMD ["/busybox/wget", "-q", "--spider", "http://localhost:3010/api/health"]
ENTRYPOINT ["/app/server"]
