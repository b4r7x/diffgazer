# Render the committed nginx config with the deployment's exact Traefik peer
# before assembling the runtime image.
FROM node:26-alpine@sha256:2d984a15c9b54fd0aeb608b8e0d0d83529eb34d2966db27a1fb4f1edc3d298a3 AS config

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
# the CI workflow rebuilds them at the same SHA and fails its
# "Dirty-tree guard (post-build)" step when the committed bytes differ.
# Rebuilding them here would only reproduce the identical bytes, so we COPY the
# committed trees directly — no build stage.
#
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
