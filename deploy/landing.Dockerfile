# Stage 1: Build landing page
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.28.2 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/landing/ apps/landing/
COPY libs/ libs/

RUN pnpm install --frozen-lockfile

RUN pnpm --filter @diffgazer/core build \
 && pnpm --filter @diffgazer/keys build \
 && pnpm --filter @diffgazer/ui build \
 && pnpm --filter @diffgazer/landing build

# Stage 2: Serve static SPA
FROM nginx:1.27-alpine AS runtime

COPY --from=builder /app/apps/landing/dist /usr/share/nginx/html
COPY deploy/spa-nginx.conf /etc/nginx/conf.d/default.conf

RUN chown -R nginx:nginx /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q --spider http://localhost/ || exit 1
