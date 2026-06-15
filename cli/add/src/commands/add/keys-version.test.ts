import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { getDefaultKeysVersionSpec } from "../../context.js";
import { addCommand } from "./command.js";

const here = dirname(fileURLToPath(import.meta.url));
const keysPackageJson = resolve(here, "../../../../../libs/keys/package.json");

test("default --keys-version tracks the libs/keys release as a caret range", () => {
  const { version } = JSON.parse(readFileSync(keysPackageJson, "utf-8")) as { version: string };
  expect(getDefaultKeysVersionSpec()).toBe(`^${version}`);
});

test("add --help surfaces the real keys version range as the --keys-version default", () => {
  const { version } = JSON.parse(readFileSync(keysPackageJson, "utf-8")) as { version: string };
  let help = "";
  addCommand.configureOutput({
    writeOut: (chunk) => {
      help += chunk;
    },
  });
  addCommand.outputHelp();
  expect(help).toContain(`Default --keys-version: ^${version}`);
});
