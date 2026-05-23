#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getErrorMessage } from "@diffgazer/core/errors";
import { HELP_TEXT, resolveCliAction } from "./cli-options.js";
import { ensureShutdownToken } from "./lib/shutdown-token.js";
import { startWeb } from "./web-launcher.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function readVersion(): string {
  const packagePath = resolve(__dirname, "../package.json");

  let metadata: unknown;
  try {
    metadata = JSON.parse(readFileSync(packagePath, "utf-8")) as unknown;
  } catch (err: unknown) {
    throw new Error(`Unable to read diffgazer package metadata: ${getErrorMessage(err)}`);
  }

  if (
    typeof metadata !== "object" ||
    metadata === null ||
    !("version" in metadata) ||
    typeof metadata.version !== "string" ||
    metadata.version.length === 0
  ) {
    throw new Error(`Invalid diffgazer package metadata at ${packagePath}: expected a non-empty string version.`);
  }

  return metadata.version;
}

async function main(): Promise<void> {
  const action = resolveCliAction(process.argv.slice(2));

  if (action.type === "help") {
    console.log(HELP_TEXT);
    return;
  }

  if (action.type === "version") {
    console.log(readVersion());
    return;
  }

  process.env.DIFFGAZER_CLI_PID = String(process.pid);
  ensureShutdownToken();

  if (action.type === "web") {
    startWeb({ mode: action.mode, openBrowser: action.openBrowser });
    return;
  }

  const { startTui } = await import("./tui-entry.js");
  await startTui({ mode: action.mode, theme: action.theme });
}

void main().catch((err: unknown) => {
  console.error(getErrorMessage(err));
  process.exit(1);
});
