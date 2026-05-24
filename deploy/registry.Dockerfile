# Stage 1: Build registry artifacts
FROM node:26-alpine@sha256:7c6af15abe4e3de859690e7db171d0d711bf37d27528eddfe625b2fe89e097f8 AS builder

RUN corepack enable && corepack prepare pnpm@10.28.2 --activate
RUN apk add --no-cache git

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY libs/ libs/
COPY scripts/ scripts/
COPY cli/add/ cli/add/

RUN pnpm install --frozen-lockfile

RUN pnpm --filter @diffgazer/registry build \
 && pnpm --filter @diffgazer/core build \
 && pnpm --filter @diffgazer/keys build \
 && pnpm --filter @diffgazer/ui build

# Stage 2: Serve static JSON
FROM nginx:1.27-alpine@sha256:65645c7bb6a0661892a8b03b89d0743208a18dd2f3f17a54ef4b76fb8e2f2a10 AS runtime

COPY --from=builder /app/libs/ui/public/r/ /usr/share/nginx/html/r/ui/
COPY --from=builder /app/libs/keys/public/r/ /usr/share/nginx/html/r/keys/
COPY apps/docs/public/schema/ /usr/share/nginx/html/schema/
COPY deploy/registry-nginx.conf /etc/nginx/conf.d/default.conf

# Security: remove default nginx page, run as non-root
RUN rm -rf /usr/share/nginx/html/index.html \
 && rm -rf /usr/share/nginx/html/50x.html \
 && chown -R nginx:nginx /usr/share/nginx/html \
 && chown -R nginx:nginx /var/cache/nginx /var/log/nginx \
 && touch /var/run/nginx.pid && chown nginx:nginx /var/run/nginx.pid

USER nginx

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/r/ui/registry.json || exit 1
