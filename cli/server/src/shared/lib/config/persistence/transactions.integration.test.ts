import { type ChildProcess, spawn } from "node:child_process";
import { access, mkdir, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { homePath, readJson, tempHome } from "./persistence.test-support.js";

beforeEach(() => {
  vi.resetModules();
});

const moduleUrlByMode = {
  settings: new URL("../store.ts", import.meta.url).href,
  trust: new URL("./trust.ts", import.meta.url).href,
};

const persistenceWorker = `
import { access, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
const persistence = await import(process.env.PERSISTENCE_MODULE_URL);
const id = process.env.WORKER_ID;
let operation;
if (process.env.MODE === "settings") {
  const patch = id === "a" ? { theme: "dark" } : { severityThreshold: "high" };
  operation = async () => {
    const store = persistence.getStore();
    await store.ready();
    const result = await store.updateSettings(patch);
    if (!result.ok) throw new Error(result.error.message);
  };
} else {
  const projectId = "project-" + id;
  const capabilities = id === "a"
    ? { readFiles: true, runCommands: false }
    : { readFiles: false, runCommands: true };
  const trustMode = "persistent";
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

const runProcessRace = async (mode: "settings" | "trust"): Promise<void> => {
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
  it(
    "preserves independent settings and trust writes from separate processes",
    { timeout: 30_000 },
    async () => {
      await runProcessRace("settings");
      await runProcessRace("trust");

      const config = await readJson<{
        schemaVersion: number;
        settings: { theme: string; severityThreshold: string };
      }>(homePath("config.json"));
      expect(config.schemaVersion).toBe(2);
      expect(config.settings).toMatchObject({ theme: "dark", severityThreshold: "high" });

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
          trustMode: "persistent",
        },
      });
    },
  );
});
