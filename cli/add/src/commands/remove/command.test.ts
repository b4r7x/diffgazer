import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as clack from "@clack/prompts";
import { withFileLock } from "@diffgazer/registry/cli";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ResolvedConfig } from "../../context.js";
import { ctx } from "../../context.js";
import { MUTATION_LOCK_RELATIVE } from "../../utils/mutation-lock.js";
import { addCommand } from "../add/command.js";
import { removeCommand, resolveRemoveTransactionFiles } from "./command.js";

vi.mock("@clack/prompts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@clack/prompts")>();
  return { ...actual, confirm: vi.fn() };
});

function createRemoveFixtureRoot(): string {
  const fixture = mkdtempSync(join(tmpdir(), "dgadd-remove-command-"));
  writeFileSync(join(fixture, "package.json"), JSON.stringify({ type: "module" }));
  writeFileSync(
    join(fixture, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["./src/*"] } } }),
  );
  mkdirSync(join(fixture, "src/styles"), { recursive: true });
  writeFileSync(join(fixture, "src/styles/styles.css"), '@import "./theme.css";\n');
  writeFileSync(
    join(fixture, "diffgazer.json"),
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
  return fixture;
}

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
    root = createRemoveFixtureRoot();
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
    vi.mocked(clack.confirm).mockReset();
    vi.restoreAllMocks();
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

  test("builds one fresh config and UI checker snapshot per invocation", async () => {
    for (const name of ["ui/panel", "ui/code-block"]) {
      await addCommand.parseAsync([
        "node",
        "dgadd",
        name,
        "--integration",
        "none",
        "--cwd",
        root,
        "--yes",
        "--skip-install",
      ]);
    }

    const configReads = vi.spyOn(ctx.config, "loadConfigWithRaw");
    const checkerBuilds = vi.spyOn(ctx, "createChecker");
    vi.spyOn(console, "log").mockImplementation(() => {});

    await removeCommand.parseAsync([
      "node",
      "dgadd",
      "ui/panel",
      "ui/code-block",
      "--cwd",
      root,
      "--yes",
    ]);

    expect(configReads).toHaveBeenCalledTimes(1);
    expect(checkerBuilds).toHaveBeenCalledTimes(1);

    await removeCommand.parseAsync(["node", "dgadd", "ui/dialog", "--cwd", root, "--yes"]);

    expect(configReads.mock.calls).toEqual([[root], [root]]);
    expect(checkerBuilds).toHaveBeenCalledTimes(2);
  });

  test("accepts unchanged nested extensions after formatting and key-order changes", async () => {
    const configPath = join(root, "diffgazer.json");
    const config = JSON.parse(readFileSync(configPath, "utf-8")) as Record<string, unknown>;
    const composedKey = "\u00e9";
    const decomposedKey = "e\u0301";
    config.tailwind = {
      css: "src/styles/styles.css",
      extension: {
        [composedKey]: { enabled: true },
        [decomposedKey]: { enabled: false },
      },
    };
    writeFileSync(configPath, JSON.stringify(config, null, 2));

    const originalStdin = process.stdin.isTTY;
    const originalStdout = process.stdout.isTTY;
    let resumeConfirmation: (confirmed: boolean) => void = () => {};
    let pausedRemoval: Promise<unknown> | undefined;
    try {
      vi.spyOn(console, "log").mockImplementation(() => {});
      let markPromptReached = () => {};
      const promptReached = new Promise<void>((resolve) => {
        markPromptReached = resolve;
      });
      const confirmation = new Promise<boolean>((resolve) => {
        resumeConfirmation = resolve;
      });
      vi.mocked(clack.confirm).mockImplementationOnce(() => {
        markPromptReached();
        return confirmation;
      });
      process.stdin.isTTY = true;
      process.stdout.isTTY = true;

      pausedRemoval = removeCommand.parseAsync(["node", "dgadd", "ui/dialog", "--cwd", root]);
      await promptReached;

      const unchanged = JSON.parse(readFileSync(configPath, "utf-8")) as Record<string, unknown>;
      const tailwind = unchanged.tailwind as Record<string, unknown>;
      unchanged.tailwind = {
        extension: {
          [decomposedKey]: { enabled: false },
          [composedKey]: { enabled: true },
        },
        css: tailwind.css,
      };
      const reordered = Object.fromEntries(Object.entries(unchanged).reverse());
      writeFileSync(configPath, JSON.stringify(reordered));

      resumeConfirmation(true);
      await pausedRemoval;

      const after = JSON.parse(readFileSync(configPath, "utf-8")) as Record<string, unknown>;
      expect(after.tailwind).toEqual(unchanged.tailwind);
      expect(after.installedItems).toBeUndefined();
    } finally {
      resumeConfirmation(true);
      await pausedRemoval?.catch(() => {});
      process.stdin.isTTY = originalStdin;
      process.stdout.isTTY = originalStdout;
    }
  });

  test("treats a current empty dependency list as authoritative after live registry drift", async () => {
    await removeCommand.parseAsync(["node", "dgadd", "ui/dialog", "--cwd", root, "--yes"]);

    await addCommand.parseAsync([
      "node",
      "dgadd",
      "ui/controllable-state",
      "--cwd",
      root,
      "--yes",
      "--skip-install",
    ]);
    await addCommand.parseAsync([
      "node",
      "dgadd",
      "ui/button",
      "--cwd",
      root,
      "--yes",
      "--skip-install",
    ]);

    expect(ctx.config.getManifestItems(root)?.["ui/controllable-state"]?.requires).toEqual([]);

    const resolveDepsBeforeDrift = ctx.registry.resolveDeps.bind(ctx.registry);
    const resolveDeps = vi.spyOn(ctx.registry, "resolveDeps").mockImplementation((names) => {
      if (names.includes("controllable-state")) return ["controllable-state", "button"];
      return resolveDepsBeforeDrift(names);
    });
    vi.spyOn(console, "log").mockImplementation(() => {});

    await removeCommand.parseAsync(["node", "dgadd", "ui/button", "--cwd", root, "--yes"]);

    expect(resolveDeps).not.toHaveBeenCalledWith(["controllable-state"]);
    expect(ctx.config.getManifestItems(root)?.["ui/controllable-state"]?.requires).toEqual([]);
    expect(ctx.config.getManifestItems(root)?.["ui/button"]).toBeUndefined();
  });

  test("fails closed when a known config value changes during confirmation", async () => {
    const configPath = join(root, "diffgazer.json");
    const sourcePath = join(root, "src/components/ui/dialog/dialog.tsx");
    const originalStdin = process.stdin.isTTY;
    const originalStdout = process.stdout.isTTY;
    let resumeConfirmation: (confirmed: boolean) => void = () => {};
    let pausedRemoval: Promise<unknown> | undefined;
    const exit = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      let markPromptReached = () => {};
      const promptReached = new Promise<void>((resolve) => {
        markPromptReached = resolve;
      });
      const confirmation = new Promise<boolean>((resolve) => {
        resumeConfirmation = resolve;
      });
      vi.mocked(clack.confirm).mockImplementationOnce(() => {
        markPromptReached();
        return confirmation;
      });
      process.stdin.isTTY = true;
      process.stdout.isTTY = true;

      pausedRemoval = removeCommand.parseAsync(["node", "dgadd", "ui/dialog", "--cwd", root]);
      await promptReached;

      const config = JSON.parse(readFileSync(configPath, "utf-8")) as Record<string, unknown>;
      config.componentsFsPath = "src/components/changed";
      writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

      resumeConfirmation(true);
      await expect(pausedRemoval).rejects.toThrow("process.exit(1)");

      expect(exit).toHaveBeenCalledWith(1);
      expect(existsSync(sourcePath)).toBe(true);
    } finally {
      resumeConfirmation(true);
      await pausedRemoval?.catch(() => {});
      process.stdin.isTTY = originalStdin;
      process.stdout.isTTY = originalStdout;
      error.mockRestore();
      exit.mockRestore();
    }
  });

  // Rewrites the project into the cross-version state an older install leaves
  // behind: the manifest records `dialog-footer-v1.tsx` while the current bundle
  // only knows `dialog-footer.tsx`, which no longer exists on disk.
  function driftInstalledPathAwayFromBundle(): { recorded: string; stable: string } {
    const bundlePath = "src/components/ui/dialog/dialog-footer.tsx";
    const recordedPath = "src/components/ui/dialog/dialog-footer-v1.tsx";
    const configPath = join(root, "diffgazer.json");
    const config = JSON.parse(readFileSync(configPath, "utf-8")) as {
      installedItems: Record<string, { files?: Array<{ path: string }> }>;
    };
    const recordedFile = config.installedItems["ui/dialog"]?.files?.find(
      (file) => file.path === bundlePath,
    );
    if (!recordedFile) throw new Error(`Expected ${bundlePath} in the ui/dialog manifest record.`);

    renameSync(join(root, bundlePath), join(root, recordedPath));
    recordedFile.path = recordedPath;
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

    return {
      recorded: join(root, recordedPath),
      stable: join(root, "src/components/ui/dialog/dialog.tsx"),
    };
  }

  // Regression: removal used to plan from the current registry item alone, so a
  // path only the manifest knows about was left orphaned on disk while its
  // ownership record was deleted — unremovable and undiffable from then on.
  test("removes a recorded path the current bundle no longer produces", async () => {
    const { recorded, stable } = driftInstalledPathAwayFromBundle();
    vi.spyOn(console, "log").mockImplementation(() => {});

    await removeCommand.parseAsync(["node", "dgadd", "ui/dialog", "--cwd", root, "--yes"]);

    expect(existsSync(recorded)).toBe(false);
    expect(existsSync(stable)).toBe(false);
    expect(ctx.config.getManifestItems(root)?.["ui/dialog"]).toBeUndefined();
  });

  test("keeps the manifest record intact when a recorded-only path was hand-edited", async () => {
    const { recorded, stable } = driftInstalledPathAwayFromBundle();
    writeFileSync(recorded, "// hand-edited after install\n");
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });

    await expect(
      removeCommand.parseAsync(["node", "dgadd", "ui/dialog", "--cwd", root, "--yes"]),
    ).rejects.toThrow("process.exit(1)");

    expect(existsSync(recorded)).toBe(true);
    expect(existsSync(stable)).toBe(true);
    expect(ctx.config.getManifestItems(root)?.["ui/dialog"]).toBeDefined();
  });

  test("serializes concurrent CSS removals under the shared mutation lock", async () => {
    await addCommand.parseAsync([
      "node",
      "dgadd",
      "ui/code-block",
      "--integration",
      "none",
      "--cwd",
      root,
      "--yes",
      "--skip-install",
    ]);
    await addCommand.parseAsync([
      "node",
      "dgadd",
      "ui/panel",
      "--integration",
      "none",
      "--cwd",
      root,
      "--yes",
      "--skip-install",
    ]);

    const lockPath = join(root, MUTATION_LOCK_RELATIVE);
    let releaseLock = () => {};
    let markLockAcquired = () => {};
    const lockAcquired = new Promise<void>((resolve) => {
      markLockAcquired = resolve;
    });
    const release = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    const barrier = withFileLock(lockPath, async () => {
      markLockAcquired();
      await release;
    });
    await lockAcquired;

    const codeBlockRemove = removeCommand.parseAsync([
      "node",
      "dgadd",
      "ui/code-block",
      "--cwd",
      root,
      "--yes",
    ]);
    const panelRemove = removeCommand.parseAsync([
      "node",
      "dgadd",
      "ui/panel",
      "--cwd",
      root,
      "--yes",
    ]);

    releaseLock();
    await barrier;
    await Promise.all([codeBlockRemove, panelRemove]);

    const config = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    expect(config.installedItems?.["ui/code-block"]).toBeUndefined();
    expect(config.installedItems?.["ui/panel"]).toBeUndefined();
    expect(existsSync(lockPath)).toBe(false);
  });

  test("keeps concurrent invocations scoped to their own project", async () => {
    const otherRoot = createRemoveFixtureRoot();
    const originalStdin = process.stdin.isTTY;
    const originalStdout = process.stdout.isTTY;
    let resumeConfirmation: (confirmed: boolean) => void = () => {};
    let pausedRemoval: Promise<unknown> | undefined;
    try {
      vi.spyOn(console, "log").mockImplementation(() => {});
      await addCommand.parseAsync([
        "node",
        "dgadd",
        "ui/panel",
        "--integration",
        "none",
        "--cwd",
        root,
        "--yes",
        "--skip-install",
      ]);
      await addCommand.parseAsync([
        "node",
        "dgadd",
        "ui/code-block",
        "--integration",
        "none",
        "--cwd",
        otherRoot,
        "--yes",
        "--skip-install",
      ]);

      const panelHash = ctx.config.getManifestItems(root)?.["ui/panel"]?.cssChunks?.[0];
      const codeBlockHash =
        ctx.config.getManifestItems(otherRoot)?.["ui/code-block"]?.cssChunks?.[0];
      if (!panelHash || !codeBlockHash) {
        throw new Error("Expected both items to own CSS chunks.");
      }

      let markPromptReached = () => {};
      const promptReached = new Promise<void>((resolve) => {
        markPromptReached = resolve;
      });
      const confirmation = new Promise<boolean>((resolve) => {
        resumeConfirmation = resolve;
      });
      vi.mocked(clack.confirm).mockImplementationOnce(() => {
        markPromptReached();
        return confirmation;
      });
      process.stdin.isTTY = true;
      process.stdout.isTTY = true;

      pausedRemoval = removeCommand.parseAsync(["node", "dgadd", "ui/panel", "--cwd", root]);
      await promptReached;

      await removeCommand.parseAsync([
        "node",
        "dgadd",
        "ui/code-block",
        "--cwd",
        otherRoot,
        "--yes",
      ]);

      expect(existsSync(join(root, "src/components/ui/panel"))).toBe(true);
      expect(ctx.config.getManifestItems(root)?.["ui/panel"]).toBeDefined();
      expect(readFileSync(join(root, "src/styles/styles.css"), "utf-8")).toContain(panelHash);
      expect(existsSync(join(otherRoot, "src/components/ui/code-block"))).toBe(false);
      expect(ctx.config.getManifestItems(otherRoot)?.["ui/code-block"]).toBeUndefined();
      expect(readFileSync(join(otherRoot, "src/styles/styles.css"), "utf-8")).not.toContain(
        codeBlockHash,
      );

      resumeConfirmation(true);
      await pausedRemoval;

      expect(existsSync(join(root, "src/components/ui/panel"))).toBe(false);
      expect(ctx.config.getManifestItems(root)?.["ui/panel"]).toBeUndefined();
      expect(readFileSync(join(root, "src/styles/styles.css"), "utf-8")).not.toContain(panelHash);
      expect(clack.confirm).toHaveBeenCalledOnce();
    } finally {
      resumeConfirmation(true);
      await pausedRemoval?.catch(() => {});
      process.stdin.isTTY = originalStdin;
      process.stdout.isTTY = originalStdout;
      rmSync(otherRoot, { recursive: true, force: true });
    }
  });

  test("fails closed when the manifest changes during confirmation", async () => {
    const manifestPath = join(root, "diffgazer.json");
    const sourcePath = join(root, "src/components/ui/dialog/dialog.tsx");
    const originalStdin = process.stdin.isTTY;
    const originalStdout = process.stdout.isTTY;
    let resumeConfirmation: (confirmed: boolean) => void = () => {};
    let pausedRemoval: Promise<unknown> | undefined;
    const exit = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      let markPromptReached = () => {};
      const promptReached = new Promise<void>((resolve) => {
        markPromptReached = resolve;
      });
      const confirmation = new Promise<boolean>((resolve) => {
        resumeConfirmation = resolve;
      });
      vi.mocked(clack.confirm).mockImplementationOnce(() => {
        markPromptReached();
        return confirmation;
      });
      process.stdin.isTTY = true;
      process.stdout.isTTY = true;

      pausedRemoval = removeCommand.parseAsync(["node", "dgadd", "ui/dialog", "--cwd", root]);
      await promptReached;

      const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
        installedItems: Record<string, unknown>;
      };
      manifest.installedItems["ui/external"] = {
        installedAt: "2026-01-01T00:00:00.000Z",
        installedAs: "explicit",
      };
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

      resumeConfirmation(true);
      await expect(pausedRemoval).rejects.toThrow("process.exit(1)");

      expect(exit).toHaveBeenCalledWith(1);
      expect(existsSync(sourcePath)).toBe(true);
      const after = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
        installedItems: Record<string, unknown>;
      };
      expect(after.installedItems["ui/dialog"]).toBeDefined();
      expect(after.installedItems["ui/external"]).toBeDefined();
    } finally {
      resumeConfirmation(true);
      await pausedRemoval?.catch(() => {});
      process.stdin.isTTY = originalStdin;
      process.stdout.isTTY = originalStdout;
      error.mockRestore();
      exit.mockRestore();
    }
  });

  test("retains a corrupt CSS owner while removing a pristine sibling item", async () => {
    for (const name of ["ui/panel", "ui/code-block"]) {
      await addCommand.parseAsync([
        "node",
        "dgadd",
        name,
        "--integration",
        "none",
        "--cwd",
        root,
        "--yes",
        "--skip-install",
      ]);
    }

    const before = ctx.config.getManifestItems(root) ?? {};
    const panelHash = before["ui/panel"]?.cssChunks?.[0];
    const codeBlockHash = before["ui/code-block"]?.cssChunks?.[0];
    if (!panelHash || !codeBlockHash) throw new Error("Expected both items to own CSS chunks.");

    const stylesPath = join(root, "src/styles/styles.css");
    writeFileSync(
      stylesPath,
      readFileSync(stylesPath, "utf-8").replace(`/* dgadd:css-end ${panelHash} */`, ""),
    );
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exit = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });

    await expect(
      removeCommand.parseAsync([
        "node",
        "dgadd",
        "ui/panel",
        "ui/code-block",
        "--cwd",
        root,
        "--yes",
      ]),
    ).rejects.toThrow("process.exit(1)");

    expect(exit).toHaveBeenCalledWith(1);

    const after = ctx.config.getManifestItems(root) ?? {};
    expect(after["ui/panel"]?.cssChunks).toEqual([panelHash]);
    expect(after["ui/code-block"]).toBeUndefined();
    const stylesheet = readFileSync(stylesPath, "utf-8");
    expect(stylesheet).toContain(`/* dgadd:css ${panelHash} */`);
    expect(stylesheet).not.toContain(codeBlockHash);
  });

  test("rejects force removal when an outer chunk contains reversed inner markers", async () => {
    for (const name of ["ui/panel", "ui/code-block"]) {
      await addCommand.parseAsync([
        "node",
        "dgadd",
        name,
        "--integration",
        "none",
        "--cwd",
        root,
        "--yes",
        "--skip-install",
      ]);
    }

    const before = ctx.config.getManifestItems(root) ?? {};
    const outerHash = before["ui/panel"]?.cssChunks?.[0];
    const innerHash = before["ui/code-block"]?.cssChunks?.[0];
    if (!outerHash || !innerHash) throw new Error("Expected both items to own CSS chunks.");

    const stylesPath = join(root, "src/styles/styles.css");
    const malformedStyles = [
      '@import "./theme.css";',
      `/* dgadd:css ${outerHash} */`,
      ".outer {}",
      `/* dgadd:css-end ${innerHash} */`,
      `/* dgadd:css ${innerHash} */`,
      ".inner {}",
      `/* dgadd:css-end ${outerHash} */`,
      "",
    ].join("\n");
    writeFileSync(stylesPath, malformedStyles);
    const exit = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      removeCommand.parseAsync(["node", "dgadd", "ui/panel", "--cwd", root, "--yes", "--force"]),
    ).rejects.toThrow("process.exit(1)");

    expect(exit).toHaveBeenCalledWith(1);
    expect(error.mock.calls.flat().join("\n")).toContain("markers are malformed");
    expect(readFileSync(stylesPath, "utf-8")).toBe(malformedStyles);
    expect(ctx.config.getManifestItems(root)?.["ui/panel"]?.cssChunks).toEqual([outerHash]);
    expect(ctx.config.getManifestItems(root)?.["ui/code-block"]?.cssChunks).toEqual([innerHash]);
  });
});
