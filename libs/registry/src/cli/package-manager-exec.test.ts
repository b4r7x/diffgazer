import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PackageManager } from "./detect.js";

const execFileMock = vi.hoisted(() => vi.fn());
const realPlatform = process.platform;

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return {
    ...actual,
    execFile: execFileMock,
  };
});

vi.mock("./terminal.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./terminal.js")>();
  return {
    ...actual,
    isSilentMode: () => true,
  };
});

import {
  installDepsWithSpinner,
  type PackageManagerLaunch,
  resolvePackageManagerLaunch,
} from "./package-manager.js";

const comSpec = process.env.ComSpec ?? "cmd.exe";

/** Stands in for the directory the real shims live in on a Windows machine. */
let pathDir: string;

function shimPath(shim: string): string {
  return join(pathDir, shim);
}

function windowsCmdLaunch(shim: string, commandArgs: string[]): PackageManagerLaunch {
  const quoted = [shimPath(shim), ...commandArgs]
    .map((arg) => `"${arg.replace(/"/g, '""')}"`)
    .join(" ");
  return {
    executable: comSpec,
    args: ["/d", "/s", "/c", `"${quoted}"`],
    windowsVerbatimArguments: true,
  };
}

function setPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, "platform", { value: platform });
}

beforeEach(() => {
  pathDir = mkdtempSync(join(tmpdir(), "registry-package-manager-path-"));
  for (const shim of ["npm.cmd", "pnpm.cmd", "yarn.cmd", "bun.exe"]) {
    writeFileSync(shimPath(shim), "");
  }
  vi.stubEnv("PATH", pathDir);
});

afterEach(() => {
  rmSync(pathDir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

describe("resolvePackageManagerLaunch", () => {
  afterEach(() => {
    setPlatform(realPlatform);
  });

  const managers: PackageManager[] = ["npm", "pnpm", "yarn", "bun"];

  it.each(managers)("returns the bare manager name on POSIX (%s)", (pm) => {
    setPlatform("linux");
    expect(resolvePackageManagerLaunch(pm, ["add", "lodash"])).toEqual({
      executable: pm,
      args: ["add", "lodash"],
    });
  });

  it("routes npm/pnpm/yarn through cmd.exe on win32", () => {
    setPlatform("win32");
    expect(resolvePackageManagerLaunch("pnpm", ["add", "lodash"])).toEqual(
      windowsCmdLaunch("pnpm.cmd", ["add", "lodash"]),
    );
    expect(resolvePackageManagerLaunch("npm", ["install", "lodash"])).toEqual(
      windowsCmdLaunch("npm.cmd", ["install", "lodash"]),
    );
    expect(resolvePackageManagerLaunch("yarn", ["add", "lodash"])).toEqual(
      windowsCmdLaunch("yarn.cmd", ["add", "lodash"]),
    );
  });

  it("quotes cmd metacharacters in the /c payload on win32", () => {
    setPlatform("win32");
    const dep = "@diffgazer/keys@^1.0.0|beta<2.0.0>0.9.0";
    expect(resolvePackageManagerLaunch("pnpm", ["add", dep])).toEqual(
      windowsCmdLaunch("pnpm.cmd", ["add", dep]),
    );
    const { args } = resolvePackageManagerLaunch("pnpm", ["add", dep]);
    expect(args[3]).toBe(`""${shimPath("pnpm.cmd")}" "add" "${dep}""`);
  });

  it("launches bun.exe directly on win32", () => {
    setPlatform("win32");
    expect(resolvePackageManagerLaunch("bun", ["add", "lodash"])).toEqual({
      executable: shimPath("bun.exe"),
      args: ["add", "lodash"],
    });
  });

  // A bare `pnpm.cmd` is resolved by cmd.exe (and by libuv, for bun.exe) against
  // the working directory before PATH, so a shim shipped in the project being
  // installed into would run instead of the real package manager.
  it("resolves shims to an absolute PATH entry instead of a bare name on win32", () => {
    setPlatform("win32");

    const { args } = resolvePackageManagerLaunch("pnpm", ["add", "lodash"]);
    expect(args[3]).toBe(`""${shimPath("pnpm.cmd")}" "add" "lodash""`);
    expect(isAbsolute(resolvePackageManagerLaunch("bun", ["add", "lodash"]).executable)).toBe(true);
  });

  // dgadd runs with the project it installs into as the working directory, and a
  // hand-edited PATH easily carries an empty (`;;`) or relative (`.`) entry that
  // `resolve` anchors right back to it.
  it("skips PATH entries that resolve to the working directory on win32", () => {
    setPlatform("win32");
    const projectDir = mkdtempSync(join(tmpdir(), "registry-package-manager-project-"));
    writeFileSync(join(projectDir, "pnpm.cmd"), "@echo hijacked\n");
    const originalCwd = process.cwd();
    process.chdir(projectDir);
    vi.stubEnv("PATH", `;.;${pathDir}`);

    try {
      const { args } = resolvePackageManagerLaunch("pnpm", ["add", "lodash"]);
      expect(args[3]).toBe(`""${shimPath("pnpm.cmd")}" "add" "lodash""`);
    } finally {
      process.chdir(originalCwd);
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  it("reports a package manager missing from PATH instead of launching a bare shim name", () => {
    setPlatform("win32");
    vi.stubEnv("PATH", join(pathDir, "absent"));
    expect(() => resolvePackageManagerLaunch("pnpm", ["add", "lodash"])).toThrow(
      "Could not find pnpm.cmd on PATH.",
    );
  });
});

describe("installDepsWithSpinner launcher", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "registry-package-manager-exec-"));
    execFileMock.mockReset();
    execFileMock.mockImplementation((_cmd, _args, _opts, callback) => {
      callback(null, "", "");
    });
    setPlatform(realPlatform);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    setPlatform(realPlatform);
    vi.clearAllMocks();
  });

  it.each([
    {
      platform: "linux" as const,
      pm: "pnpm" as const,
      deps: ["lodash"],
      expectLaunch: (): PackageManagerLaunch => ({ executable: "pnpm", args: ["add", "lodash"] }),
    },
    {
      platform: "win32" as const,
      pm: "pnpm" as const,
      deps: ["lodash"],
      expectLaunch: () => windowsCmdLaunch("pnpm.cmd", ["add", "lodash"]),
    },
    {
      platform: "linux" as const,
      pm: "npm" as const,
      deps: ["lodash"],
      expectLaunch: (): PackageManagerLaunch => ({
        executable: "npm",
        args: ["install", "lodash"],
      }),
    },
    {
      platform: "win32" as const,
      pm: "npm" as const,
      deps: ["lodash"],
      expectLaunch: () => windowsCmdLaunch("npm.cmd", ["install", "lodash"]),
    },
    {
      platform: "win32" as const,
      pm: "bun" as const,
      deps: ["lodash"],
      expectLaunch: (): PackageManagerLaunch => ({
        executable: shimPath("bun.exe"),
        args: ["add", "lodash"],
      }),
    },
    {
      platform: "win32" as const,
      pm: "pnpm" as const,
      deps: ["@scope/pkg@^1.0.0"],
      expectLaunch: () => windowsCmdLaunch("pnpm.cmd", ["add", "@scope/pkg@^1.0.0"]),
    },
  ])("execFile uses the resolved launcher with argv on $platform for $pm", async ({
    platform,
    pm,
    deps,
    expectLaunch,
  }) => {
    setPlatform(platform);
    const launch = expectLaunch();
    const ok = await installDepsWithSpinner(pm, deps, tempDir);
    expect(ok).toBe(true);
    expect(execFileMock).toHaveBeenCalledOnce();
    const [, , execOptions] = execFileMock.mock.calls[0] ?? [];
    expect(execFileMock).toHaveBeenCalledWith(
      launch.executable,
      launch.args,
      expect.objectContaining({
        cwd: tempDir,
        timeout: 120_000,
        ...("windowsVerbatimArguments" in launch && launch.windowsVerbatimArguments
          ? { windowsVerbatimArguments: true }
          : {}),
      }),
      expect.any(Function),
    );
    expect(execOptions).not.toHaveProperty("shell", true);
  });

  it("preserves cmd metacharacters in the win32 execFile payload", async () => {
    setPlatform("win32");
    const dep = "@diffgazer/keys@^1.0.0|beta<2.0.0>0.9.0";
    const ok = await installDepsWithSpinner("pnpm", [dep], tempDir);
    expect(ok).toBe(true);
    const [, args, execOptions] = execFileMock.mock.calls[0] ?? [];
    expect(args).toEqual(windowsCmdLaunch("pnpm.cmd", ["add", dep]).args);
    expect(args?.[3]).toBe(`""${shimPath("pnpm.cmd")}" "add" "${dep}""`);
    expect(execOptions).toMatchObject({ windowsVerbatimArguments: true });
    expect(execOptions).not.toHaveProperty("shell", true);
  });

  it("ignores a package-manager shim shipped inside the project being installed into", async () => {
    setPlatform("win32");
    writeFileSync(join(tempDir, "pnpm.cmd"), "@echo hijacked\n");

    const ok = await installDepsWithSpinner("pnpm", ["lodash"], tempDir);

    expect(ok).toBe(true);
    const [, args] = execFileMock.mock.calls[0] ?? [];
    expect(args?.[3]).toBe(`""${shimPath("pnpm.cmd")}" "add" "lodash""`);
  });

  it("prints package-manager stderr through error() in silent mode", async () => {
    const stderr = vi.spyOn(console, "error").mockImplementation(() => undefined);
    execFileMock.mockImplementation((_cmd, _args, _opts, callback) => {
      callback(new Error("install failed"), "", "pnpm: dependency not found");
    });

    const ok = await installDepsWithSpinner("pnpm", ["missing-pkg"], tempDir);

    expect(ok).toBe(false);
    expect(stderr.mock.calls.flat().join("\n")).toMatch(/dependency not found/);
    stderr.mockRestore();
  });

  it("rejects installation when the abort signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort(new Error("cancelled"));
    await expect(
      installDepsWithSpinner("pnpm", ["lodash"], tempDir, controller.signal),
    ).rejects.toThrow("cancelled");
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it("passes the abort signal through to execFile", async () => {
    execFileMock.mockImplementation((_cmd, _args, opts, callback) => {
      const signal = opts?.signal as AbortSignal | undefined;
      if (signal?.aborted) {
        callback(signal.reason ?? new Error("cancelled"), "", "");
        return;
      }
      signal?.addEventListener(
        "abort",
        () => {
          callback(signal.reason ?? new Error("cancelled"), "", "");
        },
        { once: true },
      );
    });
    const controller = new AbortController();
    const installPromise = installDepsWithSpinner("pnpm", ["lodash"], tempDir, controller.signal);
    await vi.waitFor(() => expect(execFileMock).toHaveBeenCalled());
    const [, , execOptions] = execFileMock.mock.calls[0] ?? [];
    expect(execOptions).toMatchObject({ signal: controller.signal });
    controller.abort(new Error("cancelled"));
    await expect(installPromise).rejects.toThrow("cancelled");
  });
});
