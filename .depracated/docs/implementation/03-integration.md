# CLI-Server Integration

## Overview

The CLI imports the server package as a workspace dependency and controls the full server lifecycle through a `ServerManager` abstraction.

## Integration Flow

```
CLI Command Handler
        |
        v
createServerManager({ port, hostname })
        |
        v
ServerManager.start()
        |
        v
createServer() from @repo/server
        |
        v
@hono/node-server serve()
        |
        v
React render (TUI) or console output (headless)
```

## Package Dependency

```json
// apps/cli/package.json
{
  "dependencies": {
    "@repo/server": "workspace:*"
  }
}
```

The CLI imports the `createServer()` factory from the server package:

```typescript
import { createServer } from "@repo/server";
```

## ServerManager Factory

**Location:** `apps/cli/src/lib/server.ts`

### Interface

```typescript
export interface ServerManagerOptions {
  port: number;
  hostname?: string;
}

export interface ServerAddress {
  port: number;
  hostname: string;
}

export interface ServerManager {
  start: () => Promise<ServerAddress>;
  stop: () => Promise<void>;
  isRunning: () => boolean;
  getAddress: () => ServerAddress | null;
}
```

### Factory Function

```typescript
export function createServerManager(options: ServerManagerOptions): ServerManager
```

Creates a manager that wraps the Hono server with lifecycle controls.

### Implementation Details

```typescript
export function createServerManager(options: ServerManagerOptions): ServerManager {
  const { port, hostname = "localhost" } = options;

  let server: ServerType | null = null;
  let currentAddress: ServerAddress | null = null;

  const start = async (): Promise<ServerAddress> => {
    if (server !== null) {
      throw new Error("Server is already running");
    }

    const app = createServer();  // Import from @repo/server

    return new Promise((resolve, reject) => {
      server = serve({
        fetch: app.fetch,
        port,
        hostname,
      });

      server.on("listening", () => {
        currentAddress = { port, hostname };
        resolve(currentAddress);
      });

      server.on("error", (error: Error) => {
        server = null;
        currentAddress = null;
        reject(error);
      });
    });
  };

  // ... stop, isRunning, getAddress methods

  return { start, stop, isRunning, getAddress };
}
```

## Startup Sequence

The server starts **before** the React component renders:

```typescript
// commands/run.ts

// 1. Create manager (no server started yet)
const manager = createServerManager({ port, hostname });

// 2. Start server and wait for it to be listening
const serverAddress = await manager.start();
const address = `http://${serverAddress.hostname}:${serverAddress.port}`;

// 3. Render React with server status as props
const { waitUntilExit } = render(
  React.createElement(App, {
    address,      // Already resolved
    isRunning: true,  // Known to be true
  })
);
```

This sequence ensures:

- Server is confirmed running before UI displays status
- No race conditions between React lifecycle and server startup
- Error handling happens before React is involved

## Shutdown Sequence

```typescript
// Signal handlers at CLI level
const shutdown = async (): Promise<void> => {
  await manager.stop();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

// Wait for UI to exit, then clean up
await waitUntilExit();
await manager.stop();
```

## Why This Pattern?

| Concern | Owner | Rationale |
|---------|-------|-----------|
| Server lifecycle | CLI command handler | Single source of truth for start/stop |
| Port/hostname config | CLI command handler | User-facing options parsed here |
| HTTP routing | Server package | Domain logic isolated |
| Display | React component | Pure rendering, no side effects |

This separation allows:

- Server package to be reused without CLI
- React component to be tested in isolation
- Clear error boundaries at each layer
