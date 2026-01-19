# Server Implementation

## Overview

The server package (`@repo/server`) provides a lightweight HTTP API built on Hono. It exports a factory function for creating the Hono application instance.

## Location

```
apps/server/
```

## Stack

| Dependency | Purpose |
|------------|---------|
| `hono` | Web framework |
| `@hono/node-server` | Node.js HTTP adapter |

## Project Structure

```
apps/server/src/
  app.ts              # createServer() factory
  index.ts            # Standalone entry point
  config/
    index.ts          # Environment-based configuration
  api/routes/
    index.ts          # Route aggregator
    health.ts         # Health check endpoint
```

## Pattern: Bulletproof Node.js

The server follows the Bulletproof Node.js architecture:

- **api/routes/** - Route definitions isolated by domain
- **config/** - Centralized configuration with environment variable parsing
- **app.ts** - Application factory, no side effects
- **index.ts** - Entry point that boots the server (side effects here only)

## Key Files

### app.ts

Factory function that creates and configures the Hono application.

```typescript
import { Hono } from "hono";
import { routes } from "./api/routes/index.js";

export function createServer(): Hono {
  const app = new Hono();
  app.route("/", routes);
  return app;
}
```

**Export:** `createServer()` returns a configured `Hono` instance without starting any HTTP listener.

### config/index.ts

Environment-based configuration with type-safe defaults.

```typescript
export const config: Config = {
  server: {
    host: getEnvVar("HOST", "127.0.0.1"),
    port: getEnvVarAsNumber("PORT", 3000),
  },
};
```

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `127.0.0.1` | Server bind address |
| `PORT` | `3000` | Server port |

### routes/health.ts

Health check endpoint returning server status.

```typescript
health.get("/", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});
```

## API Endpoints

| Method | Path | Response |
|--------|------|----------|
| GET | `/health` | `{ status: "ok", timestamp: string }` |

## Usage

### As a Library (Recommended)

```typescript
import { createServer } from "@repo/server";

const app = createServer();
// Use app.fetch with your preferred HTTP server
```

### Standalone Mode

```bash
pnpm --filter @repo/server start
```

Starts the server using `index.ts`, which calls `createServer()` and passes it to `@hono/node-server`.

## Package Exports

The package exports only the factory function from `app.ts`:

```json
{
  "exports": {
    ".": {
      "types": "./dist/app.d.ts",
      "import": "./dist/app.js"
    }
  }
}
```

This design allows consumers to control server lifecycle (port, hostname, startup timing) while the server package remains focused on route definitions.
