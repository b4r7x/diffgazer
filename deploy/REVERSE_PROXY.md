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
Hostinger VPS firewall (UFW: allow 80, 443 only)
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

All containers listen on internal ports only. The `docker-compose.yml` binds
host ports to `127.0.0.1` so they are never exposed to the public internet.

---

## Subdomain Mapping

| Subdomain | Container | Internal Port | Dockerfile | Content |
|---|---|---|---|---|
| `r.b4r7.dev` | registry | 8080 | `deploy/registry.Dockerfile` | Static JSON (shadcn registry) |
| `docs.b4r7.dev` | docs | 3000 | `Dockerfile` (root) | Node.js SSR (TanStack Start + Nitro) |
| `diffgazer.b4r7.dev` | landing | 8080 | `deploy/landing.Dockerfile` | Static SPA (Vite + React) |

---

## Coolify Domain Configuration

For each service, set the domain in the Coolify Resource settings:

### Registry (`r.b4r7.dev`)

- **Domain**: `r.b4r7.dev`
- **Port**: `8080`
- **Health Check Path**: `/r/ui/registry.json`
- **Watch Paths**: `libs/ui/public/r/**,libs/keys/public/r/**,deploy/registry*`

### Docs (`docs.b4r7.dev`)

- **Domain**: `docs.b4r7.dev`
- **Port**: `3000`
- **Health Check Path**: `/`
- **Watch Paths**: `apps/docs/**,libs/**,scripts/**`
- **Build-time env vars**:
  - `REGISTRY_ORIGIN=https://r.b4r7.dev`
  - `VITE_PUBLIC_ORIGIN=https://docs.b4r7.dev`
- **Runtime env vars**:
  - `NODE_ENV=production`
  - `PORT=3000`

### Landing (`diffgazer.b4r7.dev`)

- **Domain**: `diffgazer.b4r7.dev`
- **Port**: `8080`
- **Health Check Path**: `/`
- **Watch Paths**: `apps/landing/**,libs/ui/**`
- **Build-time env vars**:
  - `VITE_DOCS_ORIGIN=https://docs.b4r7.dev`

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

---

## Firewall Requirements

The VPS firewall (UFW) must only expose:

```
Port 80   (TCP)  -- HTTP, redirected to HTTPS by Traefik
Port 443  (TCP)  -- HTTPS, terminated by Traefik
Port 22   (TCP)  -- SSH (for management only, key auth only)
```

All container ports are bound to `127.0.0.1` in `docker-compose.yml`:

```yaml
ports:
  - "127.0.0.1:3000:3000"   # docs
  - "127.0.0.1:8081:8080"   # registry
  - "127.0.0.1:8082:8080"   # landing
```

This prevents direct access to container ports from the public internet.
All traffic must go through Traefik.

To verify firewall rules:

```sh
sudo ufw status verbose
# Expected: 80/tcp ALLOW, 443/tcp ALLOW, 22/tcp ALLOW, everything else DENY
```

To verify containers are not exposed:

```sh
# From an external machine, these should all fail/timeout:
curl -s --connect-timeout 3 http://<VPS_IP>:3000   # should timeout
curl -s --connect-timeout 3 http://<VPS_IP>:8081   # should timeout
curl -s --connect-timeout 3 http://<VPS_IP>:8082   # should timeout
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

Do NOT define custom Docker networks in docker-compose or Dockerfiles for
Coolify-managed services. Coolify manages Traefik networking automatically.
Custom networks cause intermittent HTTPS outages per Coolify docs.

The `diffgazer` bridge network in `docker-compose.yml` is for local development
only. Coolify overrides networking when deploying.
