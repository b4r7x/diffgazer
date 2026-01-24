import React from "react";
import { render } from "ink";
import { App, type SessionMode } from "../app/app.js";
import {
  type CommandOptions,
  withServer,
  registerShutdownHandlers,
  createShutdownHandler,
} from "../lib/command-utils.js";
import { setBaseUrl } from "../lib/api.js";

interface RunCommandOptions extends CommandOptions {
  continue?: boolean;
  resume?: string | true;
}

function getSessionMode(options: RunCommandOptions): {
  mode: SessionMode;
  sessionId?: string;
} {
  if (options.continue) return { mode: "continue" };
  if (options.resume === true) return { mode: "picker" };
  if (typeof options.resume === "string")
    return { mode: "resume", sessionId: options.resume };
  return { mode: "new" };
}

export async function runCommand(options: RunCommandOptions): Promise<void> {
  await withServer(options, async (manager, address) => {
    setBaseUrl(address);

    const { mode, sessionId } = getSessionMode(options);
    const { waitUntilExit } = render(
      React.createElement(App, { address, sessionMode: mode, sessionId })
    );

    const shutdown = createShutdownHandler(() => manager.stop());
    registerShutdownHandlers(shutdown);

    await waitUntilExit();
    await manager.stop().catch((err) => console.error("Cleanup error:", err));
  });
}
