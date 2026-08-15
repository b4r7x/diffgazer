import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCli } from "@diffgazer/registry/cli";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ctx } from "../context.js";
import { addCommand } from "./add/command.js";
import { diffCommand } from "./diff.js";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "dgadd-diff-css-markers-"));
  writeFileSync(join(root, "package.json"), JSON.stringify({ type: "module" }));
  writeFileSync(
    join(root, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { paths: { "@/*": ["./src/*"] } } }),
  );
  writeFileSync(
    join(root, "diffgazer.json"),
    JSON.stringify({
      aliases: {
        components: "@/components/ui",
        utils: "@/lib/utils",
        lib: "@/lib",
        hooks: "@/hooks",
      },
      componentsFsPath: "src/components/ui",
      libFsPath: "src/lib",
      hooksFsPath: "src/hooks",
      tailwind: { css: "src/styles/styles.css" },
    }),
  );
  mkdirSync(join(root, "src/styles"), { recursive: true });
  writeFileSync(join(root, "src/styles/styles.css"), "");
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

describe("diff CSS marker diagnostics", () => {
  test("reports a manifest-only CSS chunk when its upstream item is gone", async () => {
    const hash = "0123456789abcdef";
    const configPath = join(root, "diffgazer.json");
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    config.installedItems = {
      "ui/removed-css-item": {
        installedAt: "2026-08-11T00:00:00.000Z",
        cssChunks: [hash],
      },
    };
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
    writeFileSync(
      join(root, "src/styles/styles.css"),
      `/* dgadd:css ${hash} */\n.removed-item { color: red; }\n/* dgadd:css-end ${hash} */\n`,
    );

    const program = createCli({
      name: "dgadd-diff-css-markers-test",
      displayName: "DIFFGAZER DIFF CSS MARKERS TEST",
      description: "CSS marker diagnostics test",
      version: "0.0.0",
      commands: [diffCommand],
    });
    const exit = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`Unexpected process.exit(${code}).`);
    });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await program.parseAsync(["diff", "ui/removed-css-item", "--cwd", root], { from: "user" });

    const output = log.mock.calls.flat().join("\n");
    expect(exit).not.toHaveBeenCalled();
    expect(output).toContain("upstream item unavailable in current registry");
    expect(output).toContain(`styles.css~chunk-${hash}`);
    expect(output).toContain("1 changed");
    expect(output).not.toContain("up to date");
  });

  test.each<[string, (content: string, hash: string) => string]>([
    [
      "unmatched",
      (content: string, hash: string) => content.replace(`/* dgadd:css-end ${hash} */`, ""),
    ],
    [
      "reversed",
      (content: string, hash: string) =>
        content
          .replace(`/* dgadd:css ${hash} */`, "/* marker-placeholder */")
          .replace(`/* dgadd:css-end ${hash} */`, `/* dgadd:css ${hash} */`)
          .replace("/* marker-placeholder */", `/* dgadd:css-end ${hash} */`),
    ],
    [
      "duplicate",
      (content: string, hash: string) =>
        content.replace(
          `/* dgadd:css ${hash} */`,
          `/* dgadd:css ${hash} */\n/* dgadd:css ${hash} */`,
        ),
    ],
    [
      "overlapping",
      (content: string, hash: string) =>
        content
          .replace(
            `/* dgadd:css ${hash} */`,
            `/* dgadd:css ${hash} */\n/* dgadd:css 0123456789abcdef */`,
          )
          .replace(
            `/* dgadd:css-end ${hash} */`,
            `/* dgadd:css-end ${hash} */\n/* dgadd:css-end 0123456789abcdef */`,
          ),
    ],
  ])("reports %s managed markers as changed", async (_shape, corrupt) => {
    const program = createCli({
      name: "dgadd-diff-css-markers-test",
      displayName: "DIFFGAZER DIFF CSS MARKERS TEST",
      description: "CSS marker diagnostics test",
      version: "0.0.0",
      commands: [addCommand, diffCommand],
    });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await program.parseAsync(
      ["add", "ui/panel", "--integration", "none", "--cwd", root, "--yes", "--skip-install"],
      { from: "user" },
    );
    const hash = ctx.config.getManifestItems(root)?.["ui/panel"]?.cssChunks?.[0];
    if (!hash) throw new Error("Expected ui/panel to own a CSS chunk.");
    const stylesPath = join(root, "src/styles/styles.css");
    writeFileSync(stylesPath, corrupt(readFileSync(stylesPath, "utf-8"), hash));

    log.mockClear();
    await program.parseAsync(["diff", "ui/panel", "--cwd", root], { from: "user" });
    const output = log.mock.calls.flat().join("\n");
    expect(output).toContain(`Malformed managed CSS markers for chunk ${hash}`);
    expect(output).toContain("changed");
    expect(output).not.toContain("up to date");
  });
});
