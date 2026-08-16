# Render the committed nginx config with the deployment's exact Traefik peer
# before assembling the runtime image.
FROM node:26-alpine@sha256:aadf416b2cdce311a8811ba3f0608a61b77dbf997500e2eafe781b51f6a0b019 AS config

ARG REGISTRY_TRAEFIK_PROXY_CIDR=127.0.0.1/32
COPY deploy/registry-nginx.conf /tmp/registry-nginx.conf
COPY scripts/monorepo/validate-registry-proxy-cidr.mjs /tmp/validate-registry-proxy-cidr.mjs
RUN mkdir -p /etc/nginx/conf.d \
 && node /tmp/validate-registry-proxy-cidr.mjs \
      "${REGISTRY_TRAEFIK_PROXY_CIDR}" \
      /tmp/registry-nginx.conf \
      /etc/nginx/conf.d/default.conf

# Serve the committed public registry JSON.
#
# libs/{ui,keys}/public/r are the reviewable handoff contract (AGENTS.md): they
# are committed with the production REGISTRY_ORIGIN already baked in, and
# release-readiness rebuilds them at the same SHA and fails its
# "Dirty-tree guard (post-build)" step when the committed bytes differ.
# Rebuilding them here would only reproduce the identical bytes, so we COPY the
# committed trees directly — no build stage.
FROM nginx:1.31.3-alpine@sha256:4a73073bd557c65b759505da037898b61f1be6cbcc3c2c3aeac22d2a470c1752 AS runtime

COPY libs/ui/public/r/ /usr/share/nginx/html/r/ui/
COPY libs/keys/public/r/ /usr/share/nginx/html/r/keys/
COPY apps/docs/public/schema/ /usr/share/nginx/html/schema/
COPY deploy/nginx-security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=config /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf

RUN nginx -t

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
