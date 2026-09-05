import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { dgaddChildEnv } from "./commands/testing/child-env.js";

// Built once per vitest run by testing/global-setup.ts.
const entry = resolve(import.meta.dirname, "../dist/index.js");

function help(command: string): string {
  return execFileSync(process.execPath, [entry, command, "--help"], {
    encoding: "utf-8",
    env: dgaddChildEnv(),
  });
}

describe("subcommand help carries copy-pasteable examples", () => {
  test.each([
    ["init", "dgadd init"],
    ["add", "dgadd add ui/button"],
    ["list", "dgadd list --installed --json"],
    ["diff", "dgadd diff ui/button keys/navigation"],
    ["remove", "dgadd remove ui/button --yes"],
  ])("%s --help shows an Examples block", (command, example) => {
    const output = help(command);

    expect(output).toContain("Examples:");
    expect(output).toContain(example);
  });
});
