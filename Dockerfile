# ── Stage 1: Build ────────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.28.2 --activate
RUN apk add --no-cache git

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/ apps/
COPY cli/ cli/
COPY libs/ libs/
COPY scripts/ scripts/

RUN pnpm install --frozen-lockfile

RUN pnpm --filter @diffgazer/registry build
RUN pnpm --filter @diffgazer/core build
RUN pnpm --filter @diffgazer/keys build
RUN pnpm --filter @diffgazer/ui build

ARG REGISTRY_ORIGIN=https://diffgazer.com
ENV REGISTRY_ORIGIN=${REGISTRY_ORIGIN}
ENV DIFFGAZER_DEV=1

RUN pnpm --filter @diffgazer/docs build

# ── Stage 2: Runtime ──────────────────────────────────────────────────
FROM node:22-alpine AS runtime

RUN corepack enable && corepack prepare pnpm@10.28.2 --activate

WORKDIR /app

COPY --from=builder /app/apps/docs/.output .output/

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
