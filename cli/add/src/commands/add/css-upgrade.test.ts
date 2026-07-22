import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCli } from "@diffgazer/registry/cli";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ctx } from "../../context.js";
import { buildExpectedChunkContentsForItem } from "../../utils/css-chunks.js";
import { diffCommand } from "../diff.js";
import { addCommand } from "./command.js";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "dgadd-css-upgrade-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("dgadd CSS chunk upgrade reconciliation", () => {
  const oldChunkBody = 'dialog[data-state="open"] { --legacy-dialog: 1; }';
  const oldChunkHash = createHash("sha256").update(oldChunkBody).digest("hex").slice(0, 16);

  function seedCssUpgradeProject(body = oldChunkBody): string {
    writeFileSync(
      join(root, "package.json"),
      `${JSON.stringify({ name: "fixture", type: "module" }, null, 2)}\n`,
    );
    writeFileSync(
      join(root, "tsconfig.json"),
      JSON.stringify({ compilerOptions: { paths: { "@/*": ["./src/*"] } } }),
    );
    writeFileSync(
      join(root, "diffgazer.json"),
      `${JSON.stringify(
        {
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
          installedComponents: {
            "ui/dialog-shell": {
              installedAt: "2026-01-01T00:00:00.000Z",
              installedAs: "transitive",
              cssChunks: [oldChunkHash],
            },
          },
        },
        null,
        2,
      )}\n`,
    );
    mkdirSync(join(root, "src/styles"), { recursive: true });
    const stylesPath = join(root, "src/styles/styles.css");
    writeFileSync(
      stylesPath,
      `/* base */\n\n/* dgadd:css ${oldChunkHash} */\n${body}\n/* dgadd:css-end ${oldChunkHash} */\n`,
    );
    return stylesPath;
  }

  function createCssUpgradeCli() {
    return createCli({
      name: "dgadd-css-upgrade-test",
      displayName: "DIFFGAZER CSS UPGRADE TEST",
      description: "CSS upgrade reconciliation test",
      version: "0.0.0",
      commands: [addCommand, diffCommand],
    });
  }

  const addArgs = [
    "add",
    "ui/dialog",
    "--integration",
    "keys",
    "--overwrite",
    "--skip-install",
    "--yes",
  ];

  test("replaces a pristine obsolete marker and records only the current hash", async () => {
    const stylesPath = seedCssUpgradeProject();
    const program = createCssUpgradeCli();
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await program.parseAsync([...addArgs, "--cwd", root], { from: "user" });

    const [currentHash] = [...buildExpectedChunkContentsForItem("dialog-shell").keys()];
    if (!currentHash) throw new Error("Expected dialog-shell to ship a CSS chunk");
    const styles = readFileSync(stylesPath, "utf-8");
    expect(styles).not.toContain(`dgadd:css ${oldChunkHash}`);
    expect(styles.match(new RegExp(`dgadd:css ${currentHash}`, "g"))).toHaveLength(1);
    expect(ctx.config.getManifestItems(root)?.["ui/dialog-shell"]?.cssChunks).toEqual([
      currentHash,
    ]);

    log.mockClear();
    await program.parseAsync(["diff", "--cwd", root], { from: "user" });
    expect(log.mock.calls.flat().join("\n")).toContain("up to date");
  });

  test("preserves and tracks a modified obsolete marker while adding the current hash", async () => {
    const stylesPath = seedCssUpgradeProject(`${oldChunkBody}\n/* local edit */`);
    const program = createCssUpgradeCli();
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await program.parseAsync([...addArgs, "--cwd", root], { from: "user" });

    const [currentHash] = [...buildExpectedChunkContentsForItem("dialog-shell").keys()];
    if (!currentHash) throw new Error("Expected dialog-shell to ship a CSS chunk");
    const styles = readFileSync(stylesPath, "utf-8");
    expect(styles).toContain(`dgadd:css ${oldChunkHash}`);
    expect(styles).toContain("/* local edit */");
    expect(styles.match(new RegExp(`dgadd:css ${currentHash}`, "g"))).toHaveLength(1);
    expect(ctx.config.getManifestItems(root)?.["ui/dialog-shell"]?.cssChunks).toEqual([
      currentHash,
      oldChunkHash,
    ]);
    expect(warning.mock.calls.flat().join("\n")).toContain("Preserving obsolete CSS chunk");

    log.mockClear();
    await program.parseAsync(["diff", "--cwd", root], { from: "user" });
    const diffOutput = log.mock.calls.flat().join("\n");
    expect(diffOutput).toContain(`styles.css~chunk-${oldChunkHash}`);
    expect(diffOutput).toContain("changed");
  });
});
