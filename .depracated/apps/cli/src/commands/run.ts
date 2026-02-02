import { resolve } from "node:path";
import { existsSync, statSync } from "node:fs";
import { execFile } from "node:child_process";
import {
  type CommandOptions,
  withServer,
  registerShutdownHandlers,
  createShutdownHandler,
} from "../lib/command-utils.js";
import { displayBanner } from "./banner.js";

interface RunCommandOptions extends CommandOptions {
  project?: string;
}

function resolveProjectPath(projectOption?: string): string {
  if (!projectOption) return process.cwd();
  const resolved = resolve(projectOption);
  if (!existsSync(resolved)) {
    console.error(`Error: Project path does not exist: ${resolved}`);
    process.exit(1);
  }
  if (!statSync(resolved).isDirectory()) {
    console.error(`Error: Project path is not a directory: ${resolved}`);
    process.exit(1);
  }
  return resolved;
}

function openBrowser(url: string): void {
  const platform = process.platform;
  const [cmd, ...args]: [string, ...string[]] =
    platform === "darwin"
      ? ["open", url]
      : platform === "win32"
        ? ["cmd", "/c", "start", "", url]
        : ["xdg-open", url];

  execFile(cmd, args, (error) => {
    if (error) {
      console.log(`  Open ${url} in your browser to get started.`);
    }
  });
}

export async function runCommand(options: RunCommandOptions): Promise<void> {
  const projectPath = resolveProjectPath(options.project);

  await withServer({ ...options, projectPath }, async (manager, address) => {
    displayBanner(address, projectPath);
    openBrowser(address);

    // Wait for shutdown signal
    await new Promise<void>((resolve) => {
      registerShutdownHandlers(
        createShutdownHandler(async () => {
          await manager.stop();
          resolve();
        })
      );
    });
  });
}
