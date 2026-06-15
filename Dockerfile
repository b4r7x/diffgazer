# ── Stage 1: Build ────────────────────────────────────────────────────
FROM node:22-alpine@sha256:968df39aedcea65eeb078fb336ed7191baf48f972b4479711397108be0966920 AS builder

RUN corepack enable && corepack prepare pnpm@10.28.2 --activate
RUN apk add --no-cache git

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/ apps/
COPY cli/ cli/
COPY libs/ libs/
COPY scripts/ scripts/

RUN pnpm install --frozen-lockfile

ARG REGISTRY_ORIGIN=https://r.b4r7.dev
ENV REGISTRY_ORIGIN=${REGISTRY_ORIGIN}

ARG VITE_PUBLIC_ORIGIN=https://docs.b4r7.dev
ENV VITE_PUBLIC_ORIGIN=${VITE_PUBLIC_ORIGIN}

RUN pnpm --filter @diffgazer/registry build
RUN pnpm --filter @diffgazer/core build
RUN pnpm --filter @diffgazer/keys build
RUN pnpm --filter @diffgazer/ui build

# DIFFGAZER_DEV is only set when explicitly passed as a build arg.
# Without it, artifact sync auto-detects workspace vs package mode.
ARG DIFFGAZER_DEV
ENV DIFFGAZER_DEV=${DIFFGAZER_DEV}

ENV DIFFGAZER_SKIP_ARTIFACT_PREPARE=1
RUN pnpm --filter @diffgazer/docs prepare:generated

ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN pnpm --filter @diffgazer/docs build

# ── Stage 2: Runtime ──────────────────────────────────────────────────
FROM node:22-alpine@sha256:968df39aedcea65eeb078fb336ed7191baf48f972b4479711397108be0966920 AS runtime

WORKDIR /app

COPY --from=builder --chown=node:node /app/apps/docs/.output .output/

USER node

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ || exit 1

CMD ["node", ".output/server/index.mjs"]
