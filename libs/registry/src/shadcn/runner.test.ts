import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveLocalShadcnBin, runShadcnRegistryBuild } from "./runner.js";

function writeShadcnBin(tempDir: string, segments: string[]): string {
  const binDir = join(tempDir, ...segments, "node_modules", ".bin");
  mkdirSync(binDir, { recursive: true });
  const binPath = join(binDir, "shadcn");
  writeFileSync(binPath, "#!/bin/sh\n");
  chmodSync(binPath, 0o755);
  return binPath;
}

describe("shadcn binary lifecycle", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "rk-shadcn-bin-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns undefined when no shadcn binary exists", () => {
    expect(resolveLocalShadcnBin(tempDir)).toBeUndefined();
  });

  it.each([
    { label: "node_modules/.bin/ at startDir", from: [], projectFrom: [] },
    {
      label: "../node_modules/.bin/ one level up",
      from: ["packages"],
      projectFrom: ["packages", "lib"],
    },
    { label: "../../node_modules/.bin/ two levels up", from: ["a"], projectFrom: ["a", "b", "c"] },
  ])("resolves shadcn binary in $label", ({ from, projectFrom }) => {
    const projectDir = projectFrom.length === 0 ? tempDir : join(tempDir, ...projectFrom);
    if (projectFrom.length > 0) {
      mkdirSync(projectDir, { recursive: true });
    }
    const binPath = writeShadcnBin(tempDir, from);

    const resolved = resolveLocalShadcnBin(projectDir);
    expect(resolved).toBe(from.length === 0 ? binPath : resolve(binPath));
  });

  it("throws when runShadcnRegistryBuild cannot find the shadcn binary", () => {
    expect(() => runShadcnRegistryBuild({ rootDir: tempDir })).toThrow(
      "Local shadcn CLI binary not found",
    );
  });

  it("runs the shadcn binary from rootDir with the exact build/registry/--output arguments and copies the registry index", () => {
    const binDir = join(tempDir, "node_modules", ".bin");
    mkdirSync(binDir, { recursive: true });
    const binPath = join(binDir, "shadcn");
    const callLogPath = join(tempDir, "shadcn-call.log");
    writeFileSync(
      binPath,
      [
        "#!/bin/sh",
        `mkdir -p "$4"`,
        `{ pwd -P; printf '%s\\n' "$1" "$2" "$3" "$4"; } > "${callLogPath}"`,
        "exit 0",
      ].join("\n"),
    );
    chmodSync(binPath, 0o755);

    const registryPath = "registry/registry.json";
    mkdirSync(join(tempDir, "registry"), { recursive: true });
    writeFileSync(join(tempDir, registryPath), '{"items":[]}\n');

    runShadcnRegistryBuild({ rootDir: tempDir, registryPath, outputDir: "public/r" });

    const [cwd, ...args] = readFileSync(callLogPath, "utf-8").trim().split("\n");
    expect(cwd).toBe(realpathSync(tempDir));
    expect(args).toEqual(["build", registryPath, "--output", "public/r"]);
    expect(existsSync(join(tempDir, "public", "r"))).toBe(true);
    expect(readFileSync(join(tempDir, "public", "r", "registry.json"), "utf-8")).toBe(
      '{"items":[]}\n',
    );
  });

  it("throws the failing command and exit status when the shadcn binary exits nonzero", () => {
    const binDir = join(tempDir, "node_modules", ".bin");
    mkdirSync(binDir, { recursive: true });
    const binPath = join(binDir, "shadcn");
    writeFileSync(binPath, "#!/bin/sh\nexit 7\n");
    chmodSync(binPath, 0o755);

    const registryPath = "registry/registry.json";
    mkdirSync(join(tempDir, "registry"), { recursive: true });
    writeFileSync(join(tempDir, registryPath), '{"items":[]}\n');

    expect(() =>
      runShadcnRegistryBuild({ rootDir: tempDir, registryPath, outputDir: "public/r" }),
    ).toThrow(`${binPath} build ${registryPath} --output public/r failed (exit code 7)`);
  });

  it("reports the spawn error when the shadcn binary exists but cannot be executed", () => {
    const binDir = join(tempDir, "node_modules", ".bin");
    mkdirSync(binDir, { recursive: true });
    const binPath = join(binDir, "shadcn");
    writeFileSync(binPath, "#!/bin/sh\nexit 0\n");
    chmodSync(binPath, 0o644);

    const registryPath = "registry/registry.json";
    mkdirSync(join(tempDir, "registry"), { recursive: true });
    writeFileSync(join(tempDir, registryPath), '{"items":[]}\n');

    let caught: unknown;
    try {
      runShadcnRegistryBuild({ rootDir: tempDir, registryPath, outputDir: "public/r" });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).not.toContain("exit code null");
    expect((caught as Error).cause).toBeInstanceOf(Error);
  });
});
