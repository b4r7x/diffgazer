# Stage 1: Build landing page
FROM node:26-alpine@sha256:144769ec3f32e8ee36b3cfde91e82bee25d9367b20f31a151f3f7eea3a2a8541 AS builder

RUN corepack enable && corepack prepare pnpm@10.28.2 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/ apps/
COPY cli/ cli/
COPY libs/ libs/
COPY scripts/ scripts/

RUN pnpm install --frozen-lockfile

# Vite inlines VITE_-prefixed values at build time, so the docs origin override
# must be present before the landing build runs.
ARG VITE_DOCS_ORIGIN=https://docs.b4r7.dev
ENV VITE_DOCS_ORIGIN=${VITE_DOCS_ORIGIN}

RUN pnpm --filter @diffgazer/registry build \
 && pnpm --filter @diffgazer/core build \
 && pnpm --filter @diffgazer/keys build \
 && pnpm --filter @diffgazer/ui build \
 && pnpm --filter @diffgazer/landing build

# Stage 2: Serve static SPA
FROM nginx:1.31-alpine@sha256:8b1e78743a03dbb2c95171cc58639fef29abc8816598e27fb910ed2e621e589a AS runtime

COPY --from=builder /app/apps/landing/dist /usr/share/nginx/html
COPY deploy/landing-nginx.conf /etc/nginx/conf.d/default.conf

RUN chown -R nginx:nginx /usr/share/nginx/html \
 && chown -R nginx:nginx /var/cache/nginx /var/log/nginx \
 && touch /var/run/nginx.pid && chown nginx:nginx /var/run/nginx.pid

USER nginx

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/ || exit 1
