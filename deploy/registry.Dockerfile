# Stage 1: Build registry artifacts
FROM node:22-alpine AS builder

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
FROM nginx:1.27-alpine AS runtime

COPY --from=builder /app/libs/ui/public/r/ /usr/share/nginx/html/r/ui/
COPY --from=builder /app/libs/keys/public/r/ /usr/share/nginx/html/r/keys/
COPY deploy/registry-nginx.conf /etc/nginx/conf.d/default.conf

# Security: remove default nginx page, run as non-root
RUN rm -rf /usr/share/nginx/html/index.html \
 && rm -rf /usr/share/nginx/html/50x.html \
 && chown -R nginx:nginx /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q --spider http://localhost/r/ui/registry.json || exit 1
