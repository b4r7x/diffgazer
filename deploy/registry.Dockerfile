# Serve the committed public registry JSON.
#
# libs/{ui,keys}/public/r are the reviewable handoff contract (AGENTS.md): they
# are committed with the production REGISTRY_ORIGIN already baked in and are
# byte-verified against a fresh build by the release-readiness "Public registry
# is up to date" gate at the same SHA. Rebuilding them here would only reproduce
# the identical bytes, so we COPY the committed trees directly — no build stage.
FROM nginx:1.31-alpine@sha256:4a73073bd557c65b759505da037898b61f1be6cbcc3c2c3aeac22d2a470c1752 AS runtime

COPY libs/ui/public/r/ /usr/share/nginx/html/r/ui/
COPY libs/keys/public/r/ /usr/share/nginx/html/r/keys/
COPY apps/docs/public/schema/ /usr/share/nginx/html/schema/
COPY deploy/nginx-security-headers.conf /etc/nginx/snippets/security-headers.conf
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
