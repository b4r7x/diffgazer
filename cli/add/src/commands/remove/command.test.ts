import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ResolvedConfig } from "../../context.js";
import { addCommand } from "../add/command.js";
import { removeCommand, resolveRemoveTransactionFiles } from "./command.js";

describe("resolveRemoveTransactionFiles", () => {
  test("snapshots the manifest and configured stylesheet for the CLI transaction", () => {
    const config: ResolvedConfig = {
      aliases: {
        components: "@/components/ui",
        utils: "@/lib/utils",
        lib: "@/lib",
        hooks: "@/hooks",
      },
      rsc: false,
      componentsFsPath: "src/components/ui",
      hooksFsPath: "src/hooks",
      libFsPath: "src/lib",
      stylesFsPath: "src/styles",
      tailwind: { css: "src/styles/styles.css" },
    };

    expect(resolveRemoveTransactionFiles("/projects/app", config)).toEqual([
      "/projects/app/diffgazer.json",
      "/projects/app/src/styles/styles.css",
    ]);
  });

  test("snapshots only the manifest when the project has no configured stylesheet", () => {
    const config: ResolvedConfig = {
      aliases: {
        components: "@/components/ui",
        utils: "@/lib/utils",
        lib: "@/lib",
        hooks: "@/hooks",
      },
      rsc: false,
      componentsFsPath: "src/components/ui",
      hooksFsPath: "src/hooks",
      libFsPath: "src/lib",
      stylesFsPath: "src/styles",
      tailwind: undefined,
    };

    expect(resolveRemoveTransactionFiles("/projects/app", config)).toEqual([
      "/projects/app/diffgazer.json",
    ]);
  });
});

describe("removeCommand", () => {
  let root: string;

  beforeEach(async () => {
    root = mkdtempSync(join(tmpdir(), "dgadd-remove-command-"));
    writeFileSync(join(root, "package.json"), JSON.stringify({ type: "module" }));
    writeFileSync(
      join(root, "tsconfig.json"),
      JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["./src/*"] } } }),
    );
    mkdirSync(join(root, "src/styles"), { recursive: true });
    writeFileSync(join(root, "src/styles/styles.css"), '@import "./theme.css";\n');
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
    await addCommand.parseAsync([
      "node",
      "dgadd",
      "ui/dialog",
      "--cwd",
      root,
      "--yes",
      "--skip-install",
    ]);
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  // Regression: `.css` registry files are merged into styles.css as chunks and
  // never written standalone, so resolving them here reported files dgadd had
  // deliberately not created.
  test("does not report registry CSS files as missing on disk", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await removeCommand.parseAsync(["node", "dgadd", "ui/dialog", "--cwd", root, "--yes"]);

      const messages = log.mock.calls.map(([msg]) => String(msg));
      expect(messages.some((msg) => msg.includes("file not found on disk"))).toBe(false);
      expect(existsSync(join(root, "src/components/ui/dialog"))).toBe(false);
      expect(readFileSync(join(root, "src/styles/styles.css"), "utf-8")).not.toContain("dgadd:css");
    } finally {
      log.mockRestore();
    }
  });
});
