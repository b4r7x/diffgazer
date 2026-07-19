# Stage 1: Build landing page
FROM node:26-alpine@sha256:e88a35be04478413b7c71c455cd9865de9b9360e1f43456be5951032d7ac1a66 AS builder

RUN corepack enable && corepack prepare pnpm@11.13.0 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json biome.json .gitignore ./
COPY patches/ patches/
COPY apps/ apps/
COPY cli/ cli/
COPY libs/ libs/
COPY scripts/ scripts/

RUN pnpm install --frozen-lockfile

# Vite inlines VITE_-prefixed values at build time, so the docs origin override
# must be present before the landing build runs.
ARG VITE_DOCS_ORIGIN=https://docs.b4r7.dev
ARG VITE_GITHUB_URL=https://github.com/b4r7x/diffgazer
ENV VITE_DOCS_ORIGIN=${VITE_DOCS_ORIGIN}
ENV VITE_GITHUB_URL=${VITE_GITHUB_URL}

RUN pnpm --filter @diffgazer/registry build \
 && pnpm --filter @diffgazer/core build \
 && pnpm --filter @diffgazer/keys build \
 && pnpm --filter @diffgazer/ui build \
 && pnpm --filter @diffgazer/landing build

# Stage 2: Serve static SPA
FROM nginx:1.31-alpine@sha256:4a73073bd557c65b759505da037898b61f1be6cbcc3c2c3aeac22d2a470c1752 AS runtime

COPY --from=builder /app/apps/landing/dist /usr/share/nginx/html
COPY deploy/nginx-security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY deploy/landing-nginx.conf /etc/nginx/conf.d/default.conf

RUN chown -R nginx:nginx /usr/share/nginx/html \
 && chown -R nginx:nginx /var/cache/nginx /var/log/nginx \
 && touch /var/run/nginx.pid && chown nginx:nginx /var/run/nginx.pid

USER nginx

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/ || exit 1
