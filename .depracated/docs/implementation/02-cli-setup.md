# CLI Implementation

## Overview

The CLI package (`@repo/cli`) provides the `stargazer` command-line interface with two modes: interactive TUI and headless server.

## Location

```
apps/cli/
```

## Stack

| Dependency | Purpose |
|------------|---------|
| `commander` | Command-line argument parsing |
| `ink` | React-based terminal UI |
| `react` | UI components (v19) |
| `chalk` | Terminal string styling |
| `@repo/server` | Server package (workspace dependency) |
| `@hono/node-server` | HTTP server for running the API |

## Project Structure

```
apps/cli/src/
  index.ts            # Entry point, Commander setup
  commands/
    run.ts            # TUI mode command handler
    serve.ts          # Headless mode command handler
  lib/
    server.ts         # ServerManager factory
  app/
    app.tsx           # React TUI component
```

## Pattern: Functional Core

The CLI uses a functional approach:

- **No classes** - All modules export functions or plain objects
- **Factory functions** - `createServerManager()` returns an interface, not a class instance
- **Props over state** - React component receives server status as props, no internal state management for server lifecycle

## Commands

### run

Starts the interactive TUI mode.

```bash
stargazer run [options]
```

| Option | Default | Description |
|--------|---------|-------------|
| `-p, --port <port>` | `3000` | Server port |
| `-H, --hostname <hostname>` | `localhost` | Server hostname |

### serve

Starts headless server mode (no TUI).

```bash
stargazer serve [options]
```

| Option | Default | Description |
|--------|---------|-------------|
| `-p, --port <port>` | `3000` | Server port |
| `-H, --hostname <hostname>` | `localhost` | Server hostname |

## Key Files

### index.ts

CLI entry point using Commander.js.

```typescript
#!/usr/bin/env node

import { Command } from "commander";
import { runCommand } from "./commands/run.js";
import { serveCommand } from "./commands/serve.js";

const program = new Command();

program
  .name("stargazer")
  .description("Local AI coding tool")
  .version("0.1.0");

program
  .command("run")
  .description("Start interactive TUI")
  .option("-p, --port <port>", "Server port", "3000")
  .option("-H, --hostname <hostname>", "Server hostname", "localhost")
  .action(runCommand);

program
  .command("serve")
  .description("Start headless server")
  .option("-p, --port <port>", "Server port", "3000")
  .option("-H, --hostname <hostname>", "Server hostname", "localhost")
  .action(serveCommand);

program.parse();
```

### commands/run.ts

TUI command handler. Server starts **before** React renders.

```typescript
export async function runCommand(options: RunOptions): Promise<void> {
  // 1. Create server manager
  const manager = createServerManager({ port, hostname });

  // 2. Start server FIRST (before React)
  const serverAddress = await manager.start();
  const address = `http://${serverAddress.hostname}:${serverAddress.port}`;

  // 3. THEN render React (pass status as props)
  const { waitUntilExit } = render(
    React.createElement(App, { address, isRunning: true })
  );

  // 4. Signal handlers at CLI level
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());

  await waitUntilExit();
  await manager.stop();
}
```

### commands/serve.ts

Headless server command. Uses chalk for styled console output.

```typescript
export async function serveCommand(options: ServeOptions): Promise<void> {
  const manager = createServerManager({ port, hostname });

  console.log(chalk.cyan.bold("Stargazer"));
  console.log(chalk.yellow("Starting server..."));

  const address = await manager.start();
  console.log(chalk.green("Server running"));
  console.log(`Listening on ${chalk.blue(`http://${address.hostname}:${address.port}`)}`);

  // Keep process alive
  await new Promise(() => {});
}
```

### app/app.tsx

Display-only React component. No `useEffect` for server lifecycle.

```tsx
export interface AppProps {
  address: string;
  isRunning: boolean;
}

export function App({ address, isRunning }: AppProps): React.ReactElement {
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">Stargazer</Text>
      <Text>Server: <Text color="blue">{address}</Text></Text>
      <Text color={isRunning ? "green" : "red"}>
        {isRunning ? "Running" : "Stopped"}
      </Text>
      {isRunning && <Text dimColor>Press Ctrl+C to stop</Text>}
    </Box>
  );
}
```

## Architecture Decision: No useEffect for Server

The React component does **not** manage server lifecycle. Instead:

1. Command handler starts server
2. Command handler waits for server to be ready
3. Command handler renders React with status as props
4. Command handler owns shutdown logic

This keeps the React layer as a pure display component and avoids race conditions between React lifecycle and server startup.
