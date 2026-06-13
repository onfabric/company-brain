# One-shot Logto provisioner. No dependencies beyond Bun/Web built-ins, so the
# source is copied straight onto the stock Bun image with no install step.

# Bun image pinned to patch for reproducible builds; keep the minor in sync with
# .bun-version and mise.toml (and backend/Dockerfile).
FROM oven/bun:1.3.14-slim
WORKDIR /app
COPY src ./src
ENTRYPOINT ["bun", "run", "src/configure.ts"]
