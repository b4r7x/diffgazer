# Reverse Proxy: Coolify + Traefik

This project does NOT use a standalone reverse proxy (nginx proxy, Caddy, etc.).
Coolify's built-in Traefik instance handles TLS termination, subdomain routing,
and HTTP-to-HTTPS redirection for all services.

This document describes the expected configuration and how to verify it.

---

## Architecture

```
Internet (HTTPS, port 443)
    |
    v
VPS firewall (UFW: allow 80, 443 only)
    |
    v
Traefik (managed by Coolify, auto-SSL via Let's Encrypt)
    |
    +-- r.b4r7.dev          --> registry container (nginx, port 8080)
    +-- docs.b4r7.dev       --> docs container (Node.js Nitro, port 3000)
    +-- diffgazer.b4r7.dev  --> landing container (nginx, port 8080)
```

Traefik runs as a Coolify-managed service. It:
- Terminates TLS using Let's Encrypt certificates (auto-renewed)
- Routes requests by `Host` header to the correct container
- Redirects HTTP (port 80) to HTTPS (port 443)
- Sets HSTS headers at the proxy level

Production uses three separate Coolify Docker Image resources. Each resource
pulls a GHCR `:prod` image that was promoted from a scanned SHA tag by the
manual deploy workflow. This project does not keep a production or local
Docker Compose deploy path.

Production is subdomain-based. Do not mount the docs or landing apps below a
path prefix such as `/docs` or `/app` unless the app has been built for that
base path and the proxy preserves the prefix consistently. The registry is the
only service with a public path contract under `/r/**`.

---

## Subdomain Mapping

| Subdomain | Container | Internal Port | Runtime artifact | Content |
|---|---|---|---|---|
| `r.b4r7.dev` | registry | 8080 | `ghcr.io/b4r7x/diffgazer-registry:prod` | Static JSON (shadcn registry) |
| `docs.b4r7.dev` | docs | 3000 | `ghcr.io/b4r7x/diffgazer-docs:prod` | Node.js SSR (TanStack Start + Nitro) |
| `diffgazer.b4r7.dev` | landing | 8080 | `ghcr.io/b4r7x/diffgazer-landing:prod` | Static SPA (Vite + React) |

---

## Coolify Domain Configuration

For each service, create a Coolify Docker Image resource. Turn Auto Deploy off;
the manual GitHub Actions deploy promotes scanned SHA images to `:prod`, then
calls the selected Coolify webhooks. See
[`deploy/PUBLIC_DEPLOYMENT.md`](./PUBLIC_DEPLOYMENT.md) for the full runbook.

### Registry (`r.b4r7.dev`)

- **Domain**: `r.b4r7.dev`
- **Image**: `ghcr.io/b4r7x/diffgazer-registry:prod`
- **Port**: `8080`
- **Health Check Path**: `/r/ui/registry.json`
- **Auto Deploy**: off

### Docs (`docs.b4r7.dev`)

- **Domain**: `docs.b4r7.dev`
- **Image**: `ghcr.io/b4r7x/diffgazer-docs:prod`
- **Port**: `3000`
- **Health Check Path**: `/`
- **Auto Deploy**: off
- **Runtime env vars**:
  - `NODE_ENV=production`
  - `PORT=3000`

### Landing (`diffgazer.b4r7.dev`)

- **Domain**: `diffgazer.b4r7.dev`
- **Image**: `ghcr.io/b4r7x/diffgazer-landing:prod`
- **Port**: `8080`
- **Health Check Path**: `/`
- **Auto Deploy**: off

---

## Traefik Labels (Docker Labels Mode)

When Coolify uses Docker labels mode for Traefik routing, each container needs
labels like the following. Coolify generates these automatically from the
Resource domain setting -- you do not need to add them manually.

Listed here for reference and troubleshooting:

```yaml
# Registry example
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.registry.rule=Host(`r.b4r7.dev`)"
  - "traefik.http.routers.registry.entrypoints=https"
  - "traefik.http.routers.registry.tls=true"
  - "traefik.http.routers.registry.tls.certresolver=letsencrypt"
  - "traefik.http.services.registry.loadbalancer.server.port=8080"

# Docs example
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.docs.rule=Host(`docs.b4r7.dev`)"
  - "traefik.http.routers.docs.entrypoints=https"
  - "traefik.http.routers.docs.tls=true"
  - "traefik.http.routers.docs.tls.certresolver=letsencrypt"
  - "traefik.http.services.docs.loadbalancer.server.port=3000"

# Landing example
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.landing.rule=Host(`diffgazer.b4r7.dev`)"
  - "traefik.http.routers.landing.entrypoints=https"
  - "traefik.http.routers.landing.tls=true"
  - "traefik.http.routers.landing.tls.certresolver=letsencrypt"
  - "traefik.http.services.landing.loadbalancer.server.port=8080"
```

### HTTPS redirection middleware

Coolify's Traefik config includes an HTTP-to-HTTPS redirect middleware by
default. If you need to verify or add it manually:

```yaml
# Applied globally by Coolify, but for reference:
labels:
  - "traefik.http.routers.registry-http.rule=Host(`r.b4r7.dev`)"
  - "traefik.http.routers.registry-http.entrypoints=http"
  - "traefik.http.routers.registry-http.middlewares=redirect-to-https@docker"
  - "traefik.http.middlewares.redirect-to-https.redirectscheme.scheme=https"
  - "traefik.http.middlewares.redirect-to-https.redirectscheme.permanent=true"
```

### Forwarded headers and streaming

Traefik must forward the original host and scheme to each service so generated
URLs, security headers, redirects, and server-side rendering see the public
origin:

```yaml
labels:
  - "traefik.http.middlewares.forwarded.headers.customrequestheaders.X-Forwarded-Proto=https"
```

Coolify's Traefik preserves `Host`, `X-Forwarded-Proto`, and
`X-Forwarded-Host` for Docker Image resources. If an additional nginx hop is
added in front of or behind Traefik, it must keep those headers and websocket
upgrade headers instead of replacing them with container-local values:

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}

proxy_set_header Host $host;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection $connection_upgrade;
```

The CLI-embedded review server uses streaming review responses; future proxy
or websocket paths need these upgrade headers to avoid silently breaking live
review behavior. These headers are for an explicitly configured extra proxy
hop only. They are not a reason to expose container ports directly.

---

## TLS and HSTS (Defense in Depth)

HSTS is set at two levels:

1. **Traefik level**: Coolify's Traefik adds `Strict-Transport-Security` headers
   globally. This covers all subdomains as soon as traffic reaches the proxy.

2. **Application level**: The Nitro server (docs) and nginx configs (registry,
   landing) set their own security headers including CSP and framing
   controls. This is defense in depth -- if Traefik is bypassed or
   misconfigured, the application still enforces security headers.

The application-level configs also set HSTS (`Strict-Transport-Security:
max-age=31536000; includeSubDomains`) as defense in depth. If Traefik's
header is already present, the application-level header reinforces it;
if Traefik is bypassed or misconfigured, the application still enforces
HSTS on its own. In addition, they set:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY` (registry) or `SAMEORIGIN` (landing)
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy` (per-service)
- `Permissions-Policy` (restrictive)

### Docs CSP nonce

The docs app serves a per-request nonce CSP for scripts:
`script-src 'self' 'nonce-...'`. The nonce is generated in
`apps/docs/src/server.ts`, passed to TanStack Start through
`apps/docs/src/router.tsx` `ssr.nonce`, and checked by
`apps/docs/scripts/verify-csp.mjs`, which fails the build if `script-src`
allows inline scripts without a nonce. The remaining inline exception is
limited to `style-src 'unsafe-inline'` for framework and generated style
hydration.

---

## Firewall Requirements

The VPS firewall (UFW) must only expose:

```
Port 80   (TCP)  -- HTTP, redirected to HTTPS by Traefik
Port 443  (TCP)  -- HTTPS, terminated by Traefik
Port 22   (TCP)  -- SSH (for management only, key auth only)
```

Coolify Docker Image resources expose only internal container ports to Traefik:

```yaml
expose:
  - "3000"   # docs
  - "8080"   # registry and landing
```

There should be no host `ports:` mappings for these public resources. All
production traffic must go through Traefik.

To verify firewall rules:

```sh
sudo ufw status verbose
# Expected: 80/tcp ALLOW, 443/tcp ALLOW, 22/tcp ALLOW, everything else DENY
```

To verify containers are not exposed:

```sh
# From an external machine, these should all fail/timeout:
curl -s --connect-timeout 3 http://<VPS_IP>:3000   # docs — should timeout
curl -s --connect-timeout 3 http://<VPS_IP>:8080   # registry/landing — should timeout
```

---

## Verification Commands

Run these after deployment to verify each subdomain works correctly.

### Basic connectivity

```sh
# Registry -- must return JSON
curl -sI https://r.b4r7.dev/r/ui/registry.json | head -5
curl -sI https://r.b4r7.dev/r/keys/registry.json | head -5

# Docs -- must return HTML with 200
curl -sI https://docs.b4r7.dev | head -5

# Landing -- must return HTML with 200
curl -sI https://diffgazer.b4r7.dev | head -5
```

### TLS certificates

```sh
# All must show valid Let's Encrypt certificates
echo | openssl s_client -servername r.b4r7.dev -connect r.b4r7.dev:443 2>/dev/null | openssl x509 -noout -dates -issuer
echo | openssl s_client -servername docs.b4r7.dev -connect docs.b4r7.dev:443 2>/dev/null | openssl x509 -noout -dates -issuer
echo | openssl s_client -servername diffgazer.b4r7.dev -connect diffgazer.b4r7.dev:443 2>/dev/null | openssl x509 -noout -dates -issuer
```

### HTTPS redirect

```sh
# HTTP must redirect to HTTPS (301 or 308)
curl -sI http://r.b4r7.dev/r/ui/registry.json | head -3
curl -sI http://docs.b4r7.dev | head -3
curl -sI http://diffgazer.b4r7.dev | head -3
```

### HSTS header

```sh
# Must include Strict-Transport-Security
curl -sI https://r.b4r7.dev/r/ui/registry.json | grep -i strict-transport
curl -sI https://docs.b4r7.dev | grep -i strict-transport
```

### CORS (registry only)

```sh
# Registry must return Access-Control-Allow-Origin: *
curl -sI https://r.b4r7.dev/r/ui/button.json | grep -i access-control
```

### Registry content

```sh
# Verify JSON content and correct URLs
curl -s https://r.b4r7.dev/r/ui/registry.json | head -20
curl -s https://r.b4r7.dev/r/ui/button.json | jq '.registryDependencies'
```

### End-to-end shadcn install test

```sh
cd "$(mktemp -d)"
npx shadcn@latest add https://r.b4r7.dev/r/ui/button.json
# Should download and create the button component files
```

---

## Troubleshooting

### Container unreachable through Traefik

1. Check the container is running: `docker ps | grep <service>`
2. Check Traefik can reach the container's internal port:
   `docker exec <traefik-container> wget -q --spider http://<service>:<port>/`
3. Check Traefik logs: `docker logs <traefik-container> 2>&1 | tail -20`
4. Verify the domain label matches the DNS record

### Certificate not issuing

1. Verify DNS points to the VPS: `host r.b4r7.dev`
2. Check Traefik ACME logs: `docker logs <traefik-container> 2>&1 | grep acme`
3. Verify port 80 is open (Let's Encrypt HTTP-01 challenge needs it)
4. Check Coolify Settings > Server > Wildcard Domain if using wildcard certs

### Custom Docker networks

Do not define custom Docker networks for production Docker Image resources or
Dockerfiles for Coolify-managed services. Coolify manages Traefik networking
automatically. Custom networks cause intermittent HTTPS outages per Coolify
docs.
