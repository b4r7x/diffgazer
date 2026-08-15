import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../terminal.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../terminal.js")>();
  return {
    ...actual,
    error: vi.fn(),
    info: vi.fn(),
    heading: vi.fn(),
    newline: vi.fn(),
    success: vi.fn(),
    fileAction: vi.fn(),
    promptConfirm: vi.fn().mockResolvedValue(true),
  };
});

import { createInitCommand } from "./init.js";

interface TestConfig {
  componentsFsPath?: string;
  aliases?: { components?: unknown };
  installedComponents?: Record<string, { installedAt: string }>;
}

describe("createInitCommand validateReinitialize", () => {
  let tempDir: string;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "rk-init-cmd-"));
    writeFileSync(join(tempDir, "package.json"), "{}\n");
    exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`process.exit:${String(code)}`);
    });
  });

  afterEach(() => {
    exitSpy.mockRestore();
    rmSync(tempDir, { recursive: true, force: true });
  });

  async function runInit(
    validateReinitialize: (context: {
      cwd: string;
      existingConfig: TestConfig;
      options: Record<string, unknown>;
    }) => void,
    options: Record<string, unknown> = {},
  ): Promise<void> {
    const writeConfig = vi.fn();
    const cmd = createInitCommand<TestConfig>({
      configFileName: "tool.json",
      loadConfig: (cwd) => {
        const configPath = join(cwd, "tool.json");
        if (!existsSync(configPath)) {
          return { ok: false, error: "not_found" };
        }
        try {
          const parsed = JSON.parse(readFileSync(configPath, "utf-8")) as TestConfig;
          if (parsed.aliases?.components === 42) {
            return {
              ok: false,
              error: "validation_error",
              message: "Invalid aliases.components",
            };
          }
          return { ok: true, config: parsed };
        } catch {
          return { ok: false, error: "parse_error", message: "Unexpected token" };
        }
      },
      detectProject: () => ({ display: [] }),
      plannedPaths: () => [],
      createFiles: () => [],
      dependencies: [],
      onSkipInstall: () => {},
      writeConfig,
      nextSteps: [],
      validateReinitialize,
      extraOptions: [
        {
          flags: "--components-dir <path>",
          description: "Component install directory",
        },
        {
          flags: "--reset-manifest",
          description: "Discard the installed-component ownership ledger",
        },
      ],
    });

    const args = ["--cwd", tempDir, "--yes", "--force", "--skip-install"];
    if (options.componentsDir) {
      args.push("--components-dir", String(options.componentsDir));
    }
    if (options.resetManifest) {
      args.push("--reset-manifest");
    }

    await cmd.parseAsync(args, { from: "user" });
  }

  it("runs topology validation when force carries a recoverable ledger across validation_error", async () => {
    const priorConfig = {
      aliases: { components: "@/components/ui" },
      componentsFsPath: "src/components/ui",
      installedComponents: {
        "ui/button": { installedAt: "2026-01-01T00:00:00.000Z" },
      },
    };
    writeFileSync(
      join(tempDir, "tool.json"),
      `${JSON.stringify({ ...priorConfig, aliases: { components: 42 } }, null, 2)}\n`,
    );
    const before = readFileSync(join(tempDir, "tool.json"), "utf-8");

    const validateReinitialize = vi.fn(
      (context: { existingConfig: TestConfig; options: Record<string, unknown> }) => {
        const nextComponentsDir = context.options.componentsDir;
        if (nextComponentsDir && nextComponentsDir !== context.existingConfig.componentsFsPath) {
          throw new Error(
            "Cannot change the install topology while preserving installed components.",
          );
        }
      },
    );

    await expect(
      runInit(validateReinitialize, { componentsDir: "src/components/next" }),
    ).rejects.toThrow("process.exit:1");

    expect(validateReinitialize).toHaveBeenCalledTimes(1);
    expect(validateReinitialize.mock.calls[0]?.[0].existingConfig.installedComponents).toEqual(
      priorConfig.installedComponents,
    );
    expect(readFileSync(join(tempDir, "tool.json"), "utf-8")).toBe(before);
  });

  it("still runs topology validation for a valid existing config", async () => {
    writeFileSync(
      join(tempDir, "tool.json"),
      `${JSON.stringify(
        {
          aliases: { components: "@/components/ui" },
          componentsFsPath: "src/components/ui",
          installedComponents: {
            "ui/button": { installedAt: "2026-01-01T00:00:00.000Z" },
          },
        },
        null,
        2,
      )}\n`,
    );

    const validateReinitialize = vi.fn(
      (context: { existingConfig: TestConfig; options: Record<string, unknown> }) => {
        if (context.options.componentsDir === "src/components/next") {
          throw new Error(
            "Cannot change the install topology while preserving installed components.",
          );
        }
      },
    );

    await expect(
      runInit(validateReinitialize, { componentsDir: "src/components/next" }),
    ).rejects.toThrow("process.exit:1");
    expect(validateReinitialize).toHaveBeenCalledTimes(1);
  });

  it("skips topology validation when --reset-manifest drops the ledger", async () => {
    writeFileSync(
      join(tempDir, "tool.json"),
      `${JSON.stringify(
        {
          aliases: { components: 42 },
          componentsFsPath: "src/components/ui",
          installedComponents: {
            "ui/button": { installedAt: "2026-01-01T00:00:00.000Z" },
          },
        },
        null,
        2,
      )}\n`,
    );

    const validateReinitialize = vi.fn(() => {
      throw new Error("topology validation should not run");
    });

    await expect(
      runInit(validateReinitialize, {
        componentsDir: "src/components/next",
        resetManifest: true,
      }),
    ).resolves.toBeUndefined();
    expect(validateReinitialize).not.toHaveBeenCalled();
  });
});
