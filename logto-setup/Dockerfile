# One-shot Logto provisioner. No dependencies beyond Bun/Web built-ins, so the
# source is copied straight onto the stock Bun image with no install step.
FROM oven/bun:1.3.14-slim
WORKDIR /app
COPY src ./src
ENTRYPOINT ["bun", "run", "src/configure.ts"]
