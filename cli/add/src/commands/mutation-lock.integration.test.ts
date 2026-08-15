import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { computeIntegrity } from "@diffgazer/registry";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { DiffgazerAddConfigSchema, type ManifestItem } from "../context.js";
import { dgaddChildEnv } from "./testing/child-env.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const cliEntry = resolve(repoRoot, "cli/add/src/index.ts");

interface RunningCommand {
  child: ChildProcess;
  readStdout: () => string;
  result: Promise<{ code: number | null; stderr: string; stdout: string }>;
}

function commandArgs(args: string[], silent = true): string[] {
  return ["--import", "tsx", cliEntry, ...(silent ? ["--silent"] : []), ...args];
}

function runDgadd(args: string[]): void {
  execFileSync(process.execPath, commandArgs(args), { cwd: repoRoot, env: dgaddChildEnv() });
}

function startDgadd(args: string[], env: NodeJS.ProcessEnv, silent = true): RunningCommand {
  const child = spawn(process.execPath, commandArgs(args, silent), {
    cwd: repoRoot,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  let stdout = "";
  child.stdout?.setEncoding("utf8");
  child.stdout?.on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr?.setEncoding("utf8");
  child.stderr?.on("data", (chunk: string) => {
    stderr += chunk;
  });
  const result = new Promise<{ code: number | null; stderr: string; stdout: string }>(
    (resolveResult, reject) => {
      child.once("error", reject);
      child.once("close", (code) => resolveResult({ code, stderr, stdout }));
    },
  );
  return { child, readStdout: () => stdout, result };
}

async function waitUntil(condition: () => boolean, label: string): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (!condition()) {
    if (Date.now() >= deadline) throw new Error(`Timed out waiting for ${label}`);
    await new Promise((resolveWait) => setTimeout(resolveWait, 10));
  }
}

function readManifest(root: string): Record<string, ManifestItem> {
  const config = DiffgazerAddConfigSchema.parse(
    JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf8")),
  );
  return config.installedItems ?? {};
}

describe("cross-process project mutation lock", () => {
  let root: string;
  let running: RunningCommand[];

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "dgadd-mutation-lock-"));
    running = [];
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({
        type: "module",
        packageManager: "npm@10.9.2",
        devDependencies: { tailwindcss: "^4.0.0" },
      }),
    );
    writeFileSync(
      join(root, "tsconfig.json"),
      JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["./src/*"] } } }),
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
  });

  afterEach(() => {
    for (const command of running) {
      if (command.child.exitCode === null) command.child.kill("SIGKILL");
    }
    rmSync(root, { recursive: true, force: true });
  });

  test("serializes remove behind add while the package installer is awaiting completion", async () => {
    runDgadd(["add", "ui/panel", "--cwd", root, "--yes", "--skip-install"]);
    const manifestBefore = readManifest(root);
    const panelBefore = manifestBefore["ui/panel"];
    expect(panelBefore).toBeDefined();

    const fakeBin = join(root, "fake-bin");
    const installerStarted = join(root, "installer-started");
    const releaseInstaller = join(root, "release-installer");
    mkdirSync(fakeBin);
    const fakeNpm = join(fakeBin, "npm");
    writeFileSync(
      fakeNpm,
      [
        "#!/bin/sh",
        `touch '${installerStarted}'`,
        `while [ ! -f '${releaseInstaller}' ]; do sleep 0.01; done`,
      ].join("\n"),
    );
    chmodSync(fakeNpm, 0o755);
    const env = dgaddChildEnv({ PATH: `${fakeBin}:${process.env.PATH ?? ""}` });

    const add = startDgadd(
      [
        "add",
        "ui/select",
        "--integration",
        "keys",
        "--keys-version",
        "0.1.1",
        "--cwd",
        root,
        "--yes",
      ],
      env,
    );
    running.push(add);
    await Promise.race([
      waitUntil(() => existsSync(installerStarted), "installer barrier"),
      add.result.then(({ code, stderr }) => {
        throw new Error(`Add exited before installer barrier (code ${code}): ${stderr}`);
      }),
    ]);

    const remove = startDgadd(["remove", "ui/panel", "--cwd", root, "--yes"], env, false);
    running.push(remove);
    await waitUntil(
      () => remove.readStdout().includes("Waiting for another dgadd run to finish"),
      "remove process to reach the mutation lock",
    );

    expect(remove.child.exitCode).toBeNull();
    expect(readManifest(root)["ui/panel"]).toBeDefined();

    writeFileSync(releaseInstaller, "release\n");
    const [addResult, removeResult] = await Promise.all([add.result, remove.result]);
    expect(addResult, addResult.stderr).toMatchObject({ code: 0 });
    expect(removeResult, removeResult.stderr).toMatchObject({ code: 0 });

    const manifest = readManifest(root);
    const select = manifest["ui/select"];
    expect(select).toBeDefined();
    expect(manifest["ui/panel"]).toBeUndefined();

    const retainedPaths = new Set<string>();
    const retainedCssHashes = new Set<string>();
    for (const entry of Object.values(manifest)) {
      for (const file of entry.files ?? []) {
        retainedPaths.add(file.path);
        const installedPath = join(root, file.path);
        expect(existsSync(installedPath), file.path).toBe(true);
        expect(computeIntegrity(readFileSync(installedPath, "utf8")), file.path).toBe(file.hash);
      }
      for (const hash of entry.cssChunks ?? []) retainedCssHashes.add(hash);
    }

    const removedPanelPaths = (panelBefore?.files ?? [])
      .map((file) => file.path)
      .filter((path) => !retainedPaths.has(path));
    expect(removedPanelPaths.length).toBeGreaterThan(0);
    for (const path of removedPanelPaths) {
      expect(existsSync(join(root, path)), path).toBe(false);
    }

    const sharedRequirements = (panelBefore?.requires ?? []).filter(
      (name) => select?.requires?.includes(name) && manifestBefore[name] !== undefined,
    );
    expect(sharedRequirements).toContain("ui/utils");
    for (const name of sharedRequirements) {
      const retained = manifest[name];
      expect(retained, name).toBeDefined();
      expect(
        (retained?.files?.length ?? 0) + (retained?.cssChunks?.length ?? 0),
        name,
      ).toBeGreaterThan(0);
    }

    const stylesheetPath = join(root, "src/styles/styles.css");
    const stylesheet = existsSync(stylesheetPath) ? readFileSync(stylesheetPath, "utf8") : "";
    for (const hash of retainedCssHashes) {
      expect(stylesheet, hash).toContain(`/* dgadd:css ${hash}`);
      expect(stylesheet, hash).toContain(`/* dgadd:css-end ${hash}`);
    }
    for (const hash of panelBefore?.cssChunks ?? []) {
      if (retainedCssHashes.has(hash)) continue;
      expect(stylesheet, hash).not.toContain(`/* dgadd:css ${hash}`);
      expect(stylesheet, hash).not.toContain(`/* dgadd:css-end ${hash}`);
    }
    expect(existsSync(join(root, ".diffgazer/mutation.lock"))).toBe(false);
  }, 20_000);
});
