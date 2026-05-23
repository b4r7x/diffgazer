# Simple static page — no build step needed
FROM nginx:1.27-alpine AS runtime

COPY apps/hub/public/ /usr/share/nginx/html/
COPY deploy/spa-nginx.conf /etc/nginx/conf.d/default.conf

RUN chown -R nginx:nginx /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q --spider http://localhost/ || exit 1
