import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { dgaddChildEnv } from "./commands/testing/child-env.js";

const entry = resolve(import.meta.dirname, "index.ts");

function help(command: string): string {
  return execFileSync(process.execPath, ["--import", "tsx", entry, command, "--help"], {
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
