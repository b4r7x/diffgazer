import { type ChildProcess, spawn } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createDeferred } from "@diffgazer/core/testing/deferred";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { homePath, readJson, tempHome, writeJson } from "./persistence.test-support.js";

const fsHooks = vi.hoisted(() => ({
  writeJsonFileHook: null as
    | ((filePath: string, data: unknown, mode?: number) => Promise<void>)
    | null,
}));

import "./persistence.test-support.js";

beforeEach(() => {
  fsHooks.writeJsonFileHook = null;
  vi.resetModules();
});

vi.mock("../../fs.js", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../fs.js")>();
  return {
    ...real,
    writeJsonFile: (filePath: string, data: unknown, mode?: number) =>
      fsHooks.writeJsonFileHook
        ? fsHooks.writeJsonFileHook(filePath, data, mode)
        : real.writeJsonFile(filePath, data, mode),
  };
});

const moduleUrlByMode = {
  config: new URL("./config.ts", import.meta.url).href,
  secrets: new URL("./secrets.ts", import.meta.url).href,
  trust: new URL("./trust.ts", import.meta.url).href,
};

const persistenceWorker = `
import { access, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
const persistence = await import(process.env.PERSISTENCE_MODULE_URL);
const id = process.env.WORKER_ID;
let operation;
if (process.env.MODE === "config") {
  const previous = persistence.loadConfig();
  const settings = id === "a"
    ? { ...previous.settings, theme: "dark" }
    : { ...previous.settings, severityThreshold: "high" };
  operation = () => persistence.persistConfigMergedAsync(
    { ...previous, settings },
    previous.providers,
    previous.settings,
  );
} else if (process.env.MODE === "secrets") {
  const provider = id === "a" ? "gemini" : "groq";
  operation = () => persistence.persistSecretsAsync({ providers: { [provider]: id + "-key" } });
} else {
  const projectId = "project-" + id;
  const capabilities = id === "a"
    ? { readFiles: true, runCommands: false }
    : { readFiles: false, runCommands: true };
  const trustMode = id === "a" ? "persistent" : "session";
  operation = () => persistence.persistTrustRecordAsync({
    projectId,
    repoRoot: "/projects/" + id,
    trustedAt: "2026-01-01T00:00:00.000Z",
    capabilities,
    trustMode,
  });
}
await writeFile(process.env.READY_PATH, "ready");
while (true) {
  try {
    await access(process.env.START_PATH);
    break;
  } catch {
    await delay(5);
  }
}
await operation();
`;

const waitForPaths = async (filePaths: string[]): Promise<void> => {
  const deadline = Date.now() + 5_000;
  while (true) {
    try {
      await Promise.all(filePaths.map((filePath) => access(filePath)));
      return;
    } catch {
      if (Date.now() >= deadline) throw new Error("Timed out waiting for persistence workers");
      await delay(10);
    }
  }
};

const waitForExit = (child: ChildProcess): Promise<{ code: number | null; stderr: string }> =>
  new Promise((resolve, reject) => {
    let stderr = "";
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", (code) => resolve({ code, stderr }));
  });

const runProcessRace = async (mode: "config" | "secrets" | "trust"): Promise<void> => {
  const barrier = path.join(tempHome, `barrier-${mode}`);
  await mkdir(barrier);
  const startPath = path.join(barrier, "start");
  const children = ["a", "b"].map((id) =>
    spawn(
      process.execPath,
      ["--import", "tsx", "--input-type=module", "--eval", persistenceWorker],
      {
        env: {
          ...process.env,
          DIFFGAZER_HOME: tempHome,
          MODE: mode,
          PERSISTENCE_MODULE_URL: moduleUrlByMode[mode],
          READY_PATH: path.join(barrier, `${id}.ready`),
          START_PATH: startPath,
          WORKER_ID: id,
        },
        stdio: ["ignore", "ignore", "pipe"],
      },
    ),
  );
  const exits = children.map(waitForExit);

  try {
    await waitForPaths(
      children.map((_, index) => path.join(barrier, `${index === 0 ? "a" : "b"}.ready`)),
    );
    await writeFile(startPath, "start");
    const results = await Promise.all(exits);
    expect(results).toEqual([
      { code: 0, stderr: "" },
      { code: 0, stderr: "" },
    ]);
  } finally {
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    }
    await Promise.allSettled(exits);
  }
};

describe("persistence transactions", () => {
  it("rejects a transaction writer used after its callback settles without changing config", async () => {
    const { loadConfig, withConfigFileTransaction, DEFAULT_SETTINGS } = await import("./config.js");
    await writeJson("config.json", {
      settings: DEFAULT_SETTINGS,
      providers: loadConfig().providers,
    });
    const previous = loadConfig();
    const before = await readFile(homePath("config.json"), "utf8");
    const escapedWriter = await withConfigFileTransaction(async (persistMerged) => persistMerged);

    await expect(
      escapedWriter(
        { ...previous, settings: { ...previous.settings, theme: "dark" } },
        previous.providers,
        previous.settings,
      ),
    ).rejects.toThrow("Config transaction writer lease expired");
    await expect(readFile(homePath("config.json"), "utf8")).resolves.toBe(before);
  });

  it("keeps the config lock until an unawaited in-flight writer settles", async () => {
    const { loadConfig, withConfigFileTransaction, DEFAULT_SETTINGS } = await import("./config.js");
    await writeJson("config.json", {
      settings: DEFAULT_SETTINGS,
      providers: loadConfig().providers,
    });
    const previous = loadConfig();
    const writeStarted = createDeferred<void>();
    const releaseWrite = createDeferred<void>();
    const contenderEntered = createDeferred<void>();
    const realFs = await vi.importActual<typeof import("../../fs.js")>("../../fs.js");
    fsHooks.writeJsonFileHook = async (filePath, data, mode) => {
      if (filePath.endsWith("config.json")) {
        writeStarted.resolve(undefined);
        await releaseWrite.promise;
      }
      await realFs.writeJsonFile(filePath, data, mode);
    };

    let unawaitedWrite = Promise.resolve<unknown>(undefined);
    const firstTransaction = withConfigFileTransaction(async (persistMerged) => {
      unawaitedWrite = persistMerged(
        { ...previous, settings: { ...previous.settings, theme: "dark" } },
        previous.providers,
        previous.settings,
      );
    });
    await writeStarted.promise;

    const contender = withConfigFileTransaction(async () => {
      contenderEntered.resolve(undefined);
    });
    const earlyOutcome = await Promise.race([
      contenderEntered.promise.then(() => "entered" as const),
      delay(100).then(() => "blocked" as const),
    ]);

    releaseWrite.resolve(undefined);
    await Promise.all([firstTransaction, unawaitedWrite, contender]);
    expect(earlyOutcome).toBe("blocked");
  });

  it(
    "preserves disjoint config, secrets, and trust writes from independent processes",
    { timeout: 30_000 },
    async () => {
      await runProcessRace("config");
      await runProcessRace("secrets");
      await runProcessRace("trust");

      const config = await readJson<{
        settings: { theme: string; severityThreshold: string };
      }>(homePath("config.json"));
      expect(config.settings).toMatchObject({ theme: "dark", severityThreshold: "high" });

      const secrets = await readJson<{ providers: Record<string, string> }>(
        homePath("secrets.json"),
      );
      expect(secrets.providers).toEqual({ gemini: "a-key", groq: "b-key" });

      const trust = await readJson<{ projects: Record<string, unknown> }>(homePath("trust.json"));
      expect(trust.projects).toEqual({
        "project-a": {
          projectId: "project-a",
          repoRoot: "/projects/a",
          trustedAt: "2026-01-01T00:00:00.000Z",
          capabilities: { readFiles: true, runCommands: false },
          trustMode: "persistent",
        },
        "project-b": {
          projectId: "project-b",
          repoRoot: "/projects/b",
          trustedAt: "2026-01-01T00:00:00.000Z",
          capabilities: { readFiles: false, runCommands: true },
          trustMode: "session",
        },
      });
    },
  );
});
