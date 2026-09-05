# Stage 1: Build landing page
FROM node:26-alpine@sha256:2d984a15c9b54fd0aeb608b8e0d0d83529eb34d2966db27a1fb4f1edc3d298a3 AS builder

RUN corepack enable && corepack prepare pnpm@11.13.0 --activate
# python3/make/g++: the workspace lockfile carries node-pty (a root dev
# dependency with an allowed build), which node-gyp compiles from source on
# Alpine during `pnpm fetch`.
RUN apk add --no-cache python3 make g++

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
ARG VITE_DOCS_ORIGIN=https://docs.diffgazer.b4r7.dev
ARG VITE_GITHUB_URL=https://github.com/b4r7x/diffgazer
ENV VITE_DOCS_ORIGIN=${VITE_DOCS_ORIGIN}
ENV VITE_GITHUB_URL=${VITE_GITHUB_URL}

RUN pnpm --filter @diffgazer/registry build \
 && pnpm --filter @diffgazer/core build \
 && pnpm --filter @diffgazer/keys build \
 && pnpm --filter @diffgazer/ui build \
 && pnpm --filter @diffgazer/landing build

# Stage 2: Serve static SPA
# alpine-slim, not alpine: the full variant ships modules we never load
# (image-filter, xslt, geoip, njs); image-filter's chain libgd -> libXpm ->
# libXt -> libSM -> libuuid drags util-linux's libuuid into the image. A deploy was blocked by
# seven util-linux HIGH CVEs (in mount/nsenter, not even present here) because
# Alpine had published the fixed util-linux for aarch64 but not x86_64, so
# `apk upgrade` could not help on the CI runner. alpine-slim is nginx +
# busybox only: nothing to patch there and less to attack.
FROM nginx:1.31.5-alpine-slim@sha256:3b171d7224b669faa3cc2137fea0a65301791df1ec1f271ebd2a2b7461f7fade AS runtime

# The pinned base lags Alpine's security releases and the deploy workflow
# refuses to promote an image with HIGH/CRITICAL findings, so pull the fixed
# OS packages before the scan sees this layer.
#
# --ignore nginx: Alpine's community repo carries an `nginx` package with the
# same version string as the nginx.org build this image pins, and with no
# nginx-module-* packages to hold it back apk "upgrades" to it. That swaps the
# binary the digest promises for Alpine's and installs Alpine's nginx.conf,
# which includes conf.d/*.conf at the root context (http-level config lives in
# http.d/ there), so `nginx -t` below rejects our http-level directives.
RUN apk upgrade --no-cache --ignore nginx

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
