# Deployment Plan: diffgazer-workspace → Hostinger VPS + Coolify

## What We're Building

We need to deploy 4 services from a pnpm/Turborepo monorepo onto a Hostinger VPS
running Coolify (latest). Each service gets its own subdomain under `b4r7.dev`.
The domain is registered at Hostinger Domains.

| Service | Subdomain | What it is | Tech |
|---|---|---|---|
| **Registry** | `r.b4r7.dev` | Static shadcn-compatible JSON registry | Nginx static |
| **Docs** | `docs.b4r7.dev` | Component library documentation | Node.js SSR (TanStack Start + Nitro) |
| **Landing** | `diffgazer.b4r7.dev` | Product page for diffgazer CLI | Vite + React + @diffgazer/ui |
| **Hub** | `b4r7.dev` | Portfolio / project hub (placeholder) | Nginx static (single page) |

### Architecture Diagram

```
Internet
    |
    ▼
Hostinger VPS (Coolify)
    |
    ▼
Traefik (managed by Coolify, auto-SSL via Let's Encrypt)
    |
    ├── r.b4r7.dev          → registry container (nginx, static JSON)
    ├── docs.b4r7.dev       → docs container (node:22-alpine, Nitro SSR)
    ├── diffgazer.b4r7.dev  → landing container (nginx, static SPA)
    └── b4r7.dev            → hub container (nginx, single HTML page)
```

All 4 are separate Coolify Resources pointing to the same Git repository.
Coolify auto-deploys on push to `main` (zero cost — built-in feature).

> **Reverse proxy details**: See [`deploy/REVERSE_PROXY.md`](deploy/REVERSE_PROXY.md) for
> Traefik label reference, TLS/HSTS defense-in-depth notes, firewall requirements,
> and post-deploy verification commands for every subdomain.

### Single-Variable Domain Config

The registry domain (`r.b4r7.dev`) is controlled from ONE place:

```
libs/registry/src/constants.ts  →  REGISTRY_ORIGIN
```

This constant feeds into the build pipeline:
1. `pnpm run prepare:artifacts` reads it
2. Generates all 49 UI + 5 keys registry JSON files with correct URLs
3. Docs `consumption-metadata.ts` imports it for install commands

To change the registry domain in the future:
1. Edit `REGISTRY_ORIGIN` in `libs/registry/src/constants.ts`
2. Run `pnpm run prepare:artifacts`
3. Commit the regenerated JSON files
4. Push → Coolify auto-deploys

The docs domain (`docs.b4r7.dev`) is controlled via:
- Build-time env var `VITE_PUBLIC_ORIGIN` set in Coolify Resource settings
- Flows to `seo.ts`, `generate-sitemap.mjs`
- `robots.txt` must be updated manually (static file)

---

## Prerequisites

- [ ] Hostinger VPS with Coolify installed (latest)
- [ ] Domain `b4r7.dev` registered at Hostinger Domains
- [ ] Git repo accessible from VPS (GitHub, public or with deploy key)
- [ ] SSH access to VPS for initial setup

---

## Step 1: DNS Configuration (Hostinger Domains Panel)

Add these DNS records in the Hostinger domain management panel:

```
Type    Name    Value           TTL
A       @       <VPS_IP>        3600
A       *       <VPS_IP>        3600
```

The wildcard `*` record covers all subdomains (`r`, `docs`, `diffgazer`, and any future ones).

Alternatively, if wildcard is not preferred, add individual records:

```
Type    Name        Value           TTL
A       @           <VPS_IP>        3600
A       r           <VPS_IP>        3600
A       docs        <VPS_IP>        3600
A       diffgazer   <VPS_IP>        3600
```

**Wait for DNS propagation** (usually 5-30 minutes with Hostinger).
Verify: `host r.b4r7.dev` should return the VPS IP.

---

## Step 2: Code Changes (in the monorepo, before deploying)

The domain/origin code changes in 2.1–2.3 are **already applied in the working tree**.
This section now records what is done, what remains, and how to verify.

#### Completed (origins point at `r.b4r7.dev` / `docs.b4r7.dev`)

- `libs/registry/src/constants.ts` — `REGISTRY_ORIGIN = "https://r.b4r7.dev"`.
- `apps/docs/src/lib/seo.ts` — `DEFAULT_ORIGIN = "https://docs.b4r7.dev"` (overridable via `VITE_PUBLIC_ORIGIN`).
- `apps/docs/scripts/generate-sitemap.mjs` — `DEFAULT_ORIGIN = "https://docs.b4r7.dev"`.
- `apps/docs/src/lib/consumption-metadata.ts` — shadcn URLs derive from `REGISTRY_ORIGIN` / `VITE_REGISTRY_ORIGIN`, no hardcoded origin.
- `Dockerfile` (root) — `ARG REGISTRY_ORIGIN=https://r.b4r7.dev` (and `VITE_REGISTRY_ORIGIN`).
- `docker-compose.yml` (root) — `REGISTRY_ORIGIN`, `VITE_PUBLIC_ORIGIN`, `VITE_REGISTRY_ORIGIN` default to the production origins.

#### Remaining

- `apps/docs/public/robots.txt` — no committed source file yet; the sitemap URL currently lives only in build output. Add a source `robots.txt` pointing its sitemap at `https://docs.b4r7.dev/sitemap.xml` if a committed copy is wanted.
- Regenerate registry artifacts so `public/r/*.json` `registryDependencies` carry the production origin (see Verification).

#### Verification

```sh
pnpm run prepare:artifacts
grep "r.b4r7.dev" libs/ui/public/r/button.json   # registryDependencies use the production origin
grep -r "docs.diffgazer.b4r7.dev" libs apps cli   # should return nothing (old origin fully removed)
```

### 2.4: Create deployment Dockerfiles and nginx configs

See the actual files for current configuration (these are the source of truth):

- [`deploy/registry.Dockerfile`](deploy/registry.Dockerfile) -- builds registry artifacts and serves static JSON via nginx.
- [`deploy/registry-nginx.conf`](deploy/registry-nginx.conf) -- nginx config for the registry (CORS, rate limiting, security headers, explicit `/r/ui/` and `/r/keys/` location blocks).
- [`deploy/landing.Dockerfile`](deploy/landing.Dockerfile) -- builds the landing SPA and serves via nginx.
- [`deploy/hub.Dockerfile`](deploy/hub.Dockerfile) -- serves the hub static page via nginx.
- [`deploy/spa-nginx.conf`](deploy/spa-nginx.conf) -- shared nginx config for landing and hub (SPA fallback, security headers, gzip, asset caching).

### 2.5: Create apps/landing (minimal diffgazer product page)

```
apps/landing/
  package.json
  vite.config.ts
  tsconfig.json
  index.html
  src/
    main.tsx
    App.tsx
    styles/
      index.css
```

**File: `apps/landing/package.json`**

```json
{
  "name": "@diffgazer/landing",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@diffgazer/ui": "workspace:*",
    "@tailwindcss/vite": "^4.3.0",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "tailwindcss": "^4.3.0"
  },
  "devDependencies": {
    "@types/react": "^19.2.13",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^5.1.3",
    "typescript": "^5.9.3",
    "vite": "^7.3.1"
  }
}
```

**File: `apps/landing/vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { outDir: "dist" },
});
```

**File: `apps/landing/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

**File: `apps/landing/index.html`**

```html
<!doctype html>
<html lang="en" data-theme="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Diffgazer — AI Code Review for Your Terminal</title>
    <meta name="description" content="Diffgazer is a local-first AI code review tool that runs in your terminal. Install it, point it at a repo, get structured feedback." />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**File: `apps/landing/src/main.tsx`**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

**File: `apps/landing/src/styles/index.css`**

```css
@import "tailwindcss";
@import "@diffgazer/ui/theme-base.css";
@import "@diffgazer/ui/theme.css";
@import "@diffgazer/ui/styles.css";
@source "../";
```

**File: `apps/landing/src/App.tsx`**

Build a simple landing page using @diffgazer/ui components (Panel, Button, Badge, etc).
This is a placeholder — the user will build it out later. For now, just enough to verify
that @diffgazer/ui renders correctly in a standalone app:

```tsx
export function App() {
  return (
    <div className="min-h-screen bg-background font-mono text-foreground">
      <main className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-2xl font-bold text-tui-text">diffgazer</h1>
        <p className="mt-4 text-tui-dim">
          AI code review for your terminal. Local-first. Privacy-respecting.
        </p>
        <div className="mt-8 flex gap-4">
          <code className="rounded border border-tui-border bg-tui-surface-1 px-3 py-2 text-sm text-tui-blue">
            npm install -g diffgazer
          </code>
        </div>
        <div className="mt-8">
          <a
            href="https://docs.b4r7.dev"
            className="text-tui-blue underline hover:text-tui-text"
          >
            Documentation →
          </a>
        </div>
      </main>
    </div>
  );
}
```

### 2.6: Create apps/hub (minimal portfolio placeholder)

```
apps/hub/
  public/
    index.html
```

**File: `apps/hub/public/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>b4r7</title>
    <style>
      * { margin: 0; box-sizing: border-box; }
      body {
        font-family: "JetBrains Mono", monospace;
        background: #0a0a0a; color: #e0e0e0;
        display: flex; align-items: center; justify-content: center;
        min-height: 100vh; padding: 2rem;
      }
      main { max-width: 480px; }
      h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem; }
      p { color: #888; font-size: 0.875rem; line-height: 1.6; }
      a { color: #7aa2f7; text-decoration: underline; }
      a:hover { color: #e0e0e0; }
      ul { list-style: none; padding: 0; margin-top: 1.5rem; }
      li { margin-bottom: 0.75rem; }
      li::before { content: "> "; color: #555; }
    </style>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet" />
  </head>
  <body>
    <main>
      <h1>b4r7</h1>
      <p>Developer tools and open source projects.</p>
      <ul>
        <li><a href="https://diffgazer.b4r7.dev">diffgazer</a> — AI code review CLI</li>
        <li><a href="https://docs.b4r7.dev">docs</a> — component library & keyboard hooks</li>
        <li><a href="https://github.com/b4r7x">github</a></li>
      </ul>
    </main>
  </body>
</html>
```

No package.json needed — this is raw HTML served by nginx.

### 2.7: Update turbo.json

Add task entries for the new apps:

```json
"@diffgazer/landing#build": {
  "dependsOn": ["^build"],
  "outputs": ["dist/**"]
}
```

No turbo entry needed for hub (no build step).

### 2.8: Update root package.json scripts

Add convenience scripts:

```json
"landing:dev": "pnpm --filter @diffgazer/landing dev",
"landing:build": "turbo run build --filter=@diffgazer/landing"
```

### 2.9: Commit the deployment changes

The `deploy/`, `apps/landing/`, `apps/hub/`, origin, Dockerfile, compose, turbo, and
script changes from this Step already exist in the tree. Once the registry artifacts
are regenerated (2.3), stage and commit the full set:

```sh
git add deploy/ apps/landing/ apps/hub/
git add libs/registry/src/constants.ts
git add libs/ui/public/r/ libs/keys/public/r/
git add apps/docs/src/lib/seo.ts
git add apps/docs/src/lib/consumption-metadata.ts
git add apps/docs/scripts/generate-sitemap.mjs
git add Dockerfile docker-compose.yml
git add turbo.json package.json
git commit -m "feat: deployment setup for Coolify with r.b4r7.dev registry"
```

---

## Step 3: Coolify Configuration

### 3.1: Connect Git Repository

In Coolify dashboard:
1. Go to Sources → Add Git Source
2. Connect to GitHub (or add the repo URL directly)
3. Authenticate with a deploy key or GitHub App

### 3.2: Create Resource — Registry (r.b4r7.dev)

1. New Resource → Application → Select the git repo
2. Settings:
   - **Name**: `registry`
   - **Build Pack**: Dockerfile
   - **Base Directory**: `/`
   - **Dockerfile Location**: `deploy/registry.Dockerfile`
   - **Domain**: `r.b4r7.dev`
   - **Port**: `8080`
   - **Watch Paths**: `libs/ui/public/r/**,libs/keys/public/r/**,deploy/registry*`
   - **Auto Deploy**: Enabled

3. Advanced:
   - **Health Check Path**: `/r/ui/registry.json`

### 3.3: Create Resource — Docs (docs.b4r7.dev)

1. New Resource → Application → Select the git repo
2. Settings:
   - **Name**: `docs`
   - **Build Pack**: Dockerfile
   - **Base Directory**: `/`
   - **Dockerfile Location**: `Dockerfile`
   - **Domain**: `docs.b4r7.dev`
   - **Port**: `3000`
   - **Watch Paths**: `apps/docs/**,libs/**,scripts/**`
   - **Auto Deploy**: Enabled

3. Environment Variables (Build):
   - `REGISTRY_ORIGIN` = `https://r.b4r7.dev`
   - `VITE_PUBLIC_ORIGIN` = `https://docs.b4r7.dev`

4. Environment Variables (Runtime):
   - `NODE_ENV` = `production`
   - `PORT` = `3000`

### 3.4: Create Resource — Landing (diffgazer.b4r7.dev)

1. New Resource → Application → Select the git repo
2. Settings:
   - **Name**: `landing`
   - **Build Pack**: Dockerfile
   - **Base Directory**: `/`
   - **Dockerfile Location**: `deploy/landing.Dockerfile`
   - **Domain**: `diffgazer.b4r7.dev`
   - **Port**: `8080`
   - **Watch Paths**: `apps/landing/**`
   - **Auto Deploy**: Enabled

### 3.5: Create Resource — Hub (b4r7.dev)

1. New Resource → Application → Select the git repo
2. Settings:
   - **Name**: `hub`
   - **Build Pack**: Dockerfile
   - **Base Directory**: `/`
   - **Dockerfile Location**: `deploy/hub.Dockerfile`
   - **Domain**: `b4r7.dev`
   - **Port**: `8080`
   - **Watch Paths**: `apps/hub/**`
   - **Auto Deploy**: Enabled

### 3.6: SSL Certificates

Coolify + Traefik handle Let's Encrypt automatically per domain.
If using a wildcard A record, Coolify can also issue a wildcard certificate
for `*.b4r7.dev` — check Coolify Settings → Server → Wildcard Domain.

---

## Step 4: Deploy & Verify

### 4.1: Trigger Initial Deploy

Push to `main` triggers all 4 Resources to build and deploy.
Or trigger manually from Coolify dashboard per Resource.

### 4.2: Verification Checklist

```sh
# Registry — must return JSON with correct registryDependencies URLs
curl -s https://r.b4r7.dev/r/ui/registry.json | head -20
curl -s https://r.b4r7.dev/r/keys/registry.json | head -20
curl -s https://r.b4r7.dev/r/ui/button.json | jq '.registryDependencies'

# Docs — must return HTML
curl -sI https://docs.b4r7.dev | head -5

# Landing — must return HTML
curl -sI https://diffgazer.b4r7.dev | head -5

# Hub — must return HTML
curl -sI https://b4r7.dev | head -5

# SSL — all must be valid
echo | openssl s_client -servername r.b4r7.dev -connect r.b4r7.dev:443 2>/dev/null | openssl x509 -noout -dates

# CORS — registry must return Access-Control-Allow-Origin: *
curl -sI https://r.b4r7.dev/r/ui/button.json | grep -i access-control

# shadcn install test (the real proof)
mkdir /tmp/shadcn-test && cd /tmp/shadcn-test
npx shadcn@latest add https://r.b4r7.dev/r/ui/button.json
# Should download and create the button component files
```

### 4.3: Update Smoke Tests

After deployment is verified, update the smoke test origin:

```sh
# In scripts/monorepo/smoke-shadcn-install.mjs, change the registry URL
# to use https://r.b4r7.dev instead of the old domain
```

---

## Step 5: Post-Deploy Cleanup

- [ ] Update `README.md` — change all install command URLs to `r.b4r7.dev`
- [ ] Update `libs/ui/README.md` — same
- [ ] Update `libs/keys/README.md` — same
- [ ] Update `PACKAGE_GOVERNANCE.md` — mark hosted registry as live
- [ ] Run `pnpm run smoke:shadcn` with new URLs
- [ ] Verify `npx shadcn add https://r.b4r7.dev/r/ui/button.json` works from a clean project

---

## Security Checklist

- [ ] Coolify dashboard NOT accessible on a public port without auth
- [ ] Coolify admin password changed from default
- [ ] SSH key auth only (no password SSH) on VPS
- [ ] UFW firewall: allow 80, 443, 22 only
- [ ] Registry nginx: GET/HEAD/OPTIONS only (POST/PUT/DELETE denied)
- [ ] Registry nginx: X-Content-Type-Options, X-Frame-Options headers set
- [ ] Docs container: runs as non-root user
- [ ] No `.env` files or secrets committed to repo
- [ ] Docker images use specific version tags (nginx:1.27-alpine, not :latest)
- [ ] Health checks configured on all containers

---

## Coolify-Specific Notes

### Watch Paths (selective redeploy)

Coolify supports Watch Paths — only files matching the pattern trigger a redeploy.
This prevents the "push to docs → registry redeploys" problem.

If Watch Paths are not available in your Coolify version, all 4 Resources will
redeploy on every push. This is safe (idempotent) but wastes build time.

### Resource Limits

On a Hostinger VPS with limited RAM, set container limits in Coolify:

| Resource | CPU Limit | Memory Limit |
|---|---|---|
| registry | 0.25 | 64MB |
| docs | 1.0 | 512MB |
| landing | 0.25 | 64MB |
| hub | 0.1 | 32MB |

The docs container needs the most resources (Node.js SSR).
Registry, landing, and hub are nginx serving static files — minimal resources.

### Custom Networks

Do NOT define custom Docker networks in docker-compose or Dockerfiles.
Coolify manages Traefik networking automatically. Custom networks cause
intermittent HTTPS outages per Coolify docs.

---

## File Inventory (what to create)

New files:
```
deploy/
  registry.Dockerfile
  registry-nginx.conf
  landing.Dockerfile
  hub.Dockerfile
  spa-nginx.conf
apps/landing/
  package.json
  vite.config.ts
  tsconfig.json
  index.html
  src/main.tsx
  src/App.tsx
  src/styles/index.css
apps/hub/
  public/index.html
```

Modified files:
```
libs/registry/src/constants.ts          (REGISTRY_ORIGIN → r.b4r7.dev)
apps/docs/src/lib/seo.ts               (DEFAULT_ORIGIN → docs.b4r7.dev)
apps/docs/src/lib/consumption-metadata.ts  (import REGISTRY_ORIGIN)
apps/docs/scripts/generate-sitemap.mjs  (DEFAULT_ORIGIN → docs.b4r7.dev)
apps/docs/public/robots.txt            (sitemap URL → docs.b4r7.dev)
Dockerfile                             (ARG default → r.b4r7.dev)
docker-compose.yml                     (env default → r.b4r7.dev)
turbo.json                             (add landing build task)
package.json                           (add landing convenience scripts)
libs/ui/public/r/*.json                (regenerated — 49 files)
libs/keys/public/r/*.json              (regenerated — 5 files)
```

---

## Estimated Timeline

| Phase | Time |
|---|---|
| DNS setup | 5 min + 30 min propagation |
| Code changes (step 2) | 30-60 min |
| Coolify Resources setup (step 3) | 20 min |
| First deploy + debug | 30-60 min |
| Verification (step 4) | 15 min |
| Post-deploy cleanup (step 5) | 15 min |
| **Total** | **~2-3 hours** |
