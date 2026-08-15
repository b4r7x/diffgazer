import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { computeIntegrity } from "@diffgazer/registry";
import { createCli } from "@diffgazer/registry/cli";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ctx } from "../context.js";
import { addCommand } from "./add/command.js";
import { diffCommand } from "./diff.js";
import { removeCommand } from "./remove/command.js";

let root: string;

function seedProject(): void {
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
      },
      null,
      2,
    )}\n`,
  );
  mkdirSync(join(root, "src/styles"), { recursive: true });
  writeFileSync(join(root, "src/styles/styles.css"), "");
}

function createCliProgram() {
  return createCli({
    name: "dgadd-manifest-drift-test",
    displayName: "DIFFGAZER MANIFEST DRIFT TEST",
    description: "manifest drift upgrade test",
    version: "0.0.0",
    commands: [addCommand, diffCommand, removeCommand],
  });
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "dgadd-manifest-drift-"));
  seedProject();
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("manifest-backed diff and remove after registry drift", () => {
  test("diff and remove tolerate a manifest entry whose upstream item was removed", async () => {
    const program = createCliProgram();
    await program.parseAsync(["add", "ui/button", "--cwd", root, "--yes", "--skip-install"], {
      from: "user",
    });

    const buttonIndex = join(root, "src/components/ui/button/index.ts");
    expect(existsSync(buttonIndex)).toBe(true);

    const originalGetItem = ctx.registry.getItem.bind(ctx.registry);
    const getItem = vi.spyOn(ctx.registry, "getItem").mockImplementation((name) => {
      if (name === "button") return undefined;
      return originalGetItem(name);
    });

    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await program.parseAsync(["diff", "--cwd", root], { from: "user" });
    const diffOutput = log.mock.calls.flat().join("\n");
    expect(diffOutput).toContain("upstream item unavailable");
    expect(diffOutput).not.toContain("not found");

    log.mockClear();
    await program.parseAsync(["remove", "ui/button", "--cwd", root, "--yes"], { from: "user" });

    expect(existsSync(buttonIndex)).toBe(false);
    expect(ctx.config.getManifestItems(root)?.["ui/button"]).toBeUndefined();
    log.mockRestore();
    getItem.mockRestore();
  });

  test("remove deletes manifest-owned paths that are absent from the current registry", async () => {
    const program = createCliProgram();
    await program.parseAsync(["add", "ui/button", "--cwd", root, "--yes", "--skip-install"], {
      from: "user",
    });

    const legacyPath = join(root, "src/components/ui/button/button-v1.tsx");
    const legacyBody = "export const legacyButton = true;\n";
    writeFileSync(legacyPath, legacyBody);

    const config = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8")) as {
      installedItems: Record<
        string,
        { files?: Array<{ path: string; hash: string; item: string }> }
      >;
    };
    const button = config.installedItems["ui/button"];
    if (!button) throw new Error("Expected ui/button in manifest");
    button.files = [
      ...(button.files ?? []),
      {
        path: "src/components/ui/button/button-v1.tsx",
        hash: computeIntegrity(legacyBody),
        item: "ui/button",
      },
    ];
    writeFileSync(join(root, "diffgazer.json"), `${JSON.stringify(config, null, 2)}\n`);

    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await program.parseAsync(["remove", "ui/button", "--cwd", root, "--yes"], { from: "user" });

    expect(existsSync(legacyPath)).toBe(false);
    expect(existsSync(join(root, "src/components/ui/button"))).toBe(false);
    expect(ctx.config.getManifestItems(root)?.["ui/button"]).toBeUndefined();
    log.mockRestore();
  });

  test("diff surfaces manifest-only paths without re-adding after an upstream rename", async () => {
    const program = createCliProgram();
    await program.parseAsync(["add", "ui/button", "--cwd", root, "--yes", "--skip-install"], {
      from: "user",
    });

    const legacyPath = join(root, "src/components/ui/button/button-v1.tsx");
    const legacyBody = "export const legacyButton = true;\n";
    writeFileSync(legacyPath, legacyBody);

    const config = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8")) as {
      installedItems: Record<
        string,
        { files?: Array<{ path: string; hash: string; item: string }> }
      >;
    };
    const button = config.installedItems["ui/button"];
    if (!button) throw new Error("Expected ui/button in manifest");
    button.files = [
      ...(button.files ?? []),
      {
        path: "src/components/ui/button/button-v1.tsx",
        hash: computeIntegrity(legacyBody),
        item: "ui/button",
      },
    ];
    writeFileSync(join(root, "diffgazer.json"), `${JSON.stringify(config, null, 2)}\n`);

    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await program.parseAsync(["diff", "ui/button", "--cwd", root], { from: "user" });
    const diffOutput = log.mock.calls.flat().join("\n");
    expect(diffOutput).toContain("button-v1.tsx~installed");
    expect(diffOutput).toContain("changed");
    log.mockRestore();
  });
});
