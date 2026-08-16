# Stage 1: Build landing page
FROM node:26-alpine@sha256:aadf416b2cdce311a8811ba3f0608a61b77dbf997500e2eafe781b51f6a0b019 AS builder

RUN corepack enable && corepack prepare pnpm@11.13.0 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY patches/ patches/
COPY apps/docs/package.json apps/docs/package.json
COPY apps/landing/package.json apps/landing/package.json
COPY apps/web/package.json apps/web/package.json
COPY cli/add/package.json cli/add/package.json
COPY cli/diffgazer/package.json cli/diffgazer/package.json
COPY cli/server/package.json cli/server/package.json
COPY libs/core/package.json libs/core/package.json
COPY libs/keys/artifacts/package.json libs/keys/artifacts/package.json
COPY libs/keys/examples/playground/package.json libs/keys/examples/playground/package.json
COPY libs/keys/package.json libs/keys/package.json
COPY libs/registry/package.json libs/registry/package.json
COPY libs/ui/package.json libs/ui/package.json

RUN pnpm fetch --frozen-lockfile

RUN pnpm install --frozen-lockfile --offline

COPY turbo.json biome.json .gitignore ./
COPY apps/ apps/
COPY cli/ cli/
COPY libs/ libs/
COPY scripts/ scripts/

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
FROM nginx:1.31.3-alpine@sha256:4a73073bd557c65b759505da037898b61f1be6cbcc3c2c3aeac22d2a470c1752 AS runtime

COPY --from=builder /app/apps/landing/dist /usr/share/nginx/html
COPY deploy/nginx-security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY deploy/landing-nginx.conf /etc/nginx/conf.d/default.conf

RUN nginx -t

RUN rm -f /usr/share/nginx/html/50x.html \
 && chown -R nginx:nginx /usr/share/nginx/html \
 && chown -R nginx:nginx /var/cache/nginx /var/log/nginx \
 && touch /var/run/nginx.pid && chown nginx:nginx /var/run/nginx.pid

USER nginx

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/ || exit 1
