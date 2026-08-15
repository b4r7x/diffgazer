import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { REGISTRY_ORIGIN } from "@diffgazer/registry/cli";
import { describe, expect, test } from "vitest";
import { VERSION } from "../context.js";
import { initCommand } from "./init.js";

const readme = readFileSync(resolve(import.meta.dirname, "../../README.md"), "utf-8");

function configExample(): Record<string, unknown> {
  const block = readme.match(/```json\n([\s\S]*?)```/)?.[1];
  if (!block) throw new Error("README has no json config example");
  return JSON.parse(block);
}

describe("README documents the init contract", () => {
  test("every registered init option appears in the options table", () => {
    const flags = initCommand.options.map((option) => option.long ?? option.short);

    for (const flag of flags) {
      expect(readme, `README is missing the \`${flag}\` init option`).toContain(`\`${flag}`);
    }
  });

  test("the config example carries exactly the keys init writes", () => {
    expect(Object.keys(configExample())).toEqual([
      "$schema",
      "version",
      "aliases",
      "componentsFsPath",
      "libFsPath",
      "hooksFsPath",
      "rsc",
      "tailwind",
    ]);
  });

  test("the config example pins the generated schema url and CLI version", () => {
    const example = configExample();

    expect(example.$schema).toBe(`${REGISTRY_ORIGIN}/schema/diffgazer.json`);
    expect(example.version).toBe(VERSION);
  });
});
