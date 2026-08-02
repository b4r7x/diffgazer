import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildCliChildEnvironment } from "./cli-compatibility.js";
import { probeCliAuthStore, probeCliModelPolicy } from "./cli-vendor-probes.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

async function fakeVendorCli(script: string): Promise<{ executable: string; cwd: string }> {
  const root = await mkdtemp(path.join(tmpdir(), "cli-vendor-probe-"));
  roots.push(root);
  const executable = path.join(root, "vendor-cli");
  await writeFile(executable, `#!/bin/sh\n${script}\n`, "utf8");
  await chmod(executable, 0o755);
  return { executable, cwd: root };
}

function childEnv(): Record<string, string> {
  const ambientHome = process.env.HOME ?? "/home/user";
  const env = buildCliChildEnvironment(
    { PATH: process.env.PATH ?? "/usr/bin", HOME: ambientHome },
    { ambientHome },
  );
  if (!env.ok) throw new Error("child environment rejected");
  return env.value;
}

describe.skipIf(process.platform === "win32")("vendor CLI auth evidence", () => {
  it("reports unavailable when the auth-status subcommand is unsupported", async () => {
    const { executable, cwd } = await fakeVendorCli('echo "unknown command" >&2; exit 1');

    const result = await probeCliAuthStore("copilot-cli", { executable, cwd, env: childEnv() });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.authStoreEvidence).toBe("unavailable");
  });

  it("reports unavailable when a runnable binary prints no sign-in evidence", async () => {
    const { executable, cwd } = await fakeVendorCli('echo "Copilot CLI usage: copilot [options]"');

    const result = await probeCliAuthStore("copilot-cli", { executable, cwd, env: childEnv() });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.authStoreEvidence).toBe("unavailable");
  });

  it("accepts a positive auth status from the vendor store", async () => {
    const { executable, cwd } = await fakeVendorCli('echo "Logged in as octocat"');

    const result = await probeCliAuthStore("copilot-cli", { executable, cwd, env: childEnv() });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.authStoreEvidence).toBe("secure-store-reachable");
  });

  it("reports plaintext fallback storage as its own evidence", async () => {
    const { executable, cwd } = await fakeVendorCli('echo "Logged in; token stored in plaintext"');

    const result = await probeCliAuthStore("copilot-cli", { executable, cwd, env: childEnv() });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.authStoreEvidence).toBe("plaintext-fallback");
  });
});

describe.skipIf(process.platform === "win32")("vendor CLI model policy evidence", () => {
  it("rejects a model that only appears inside prose rather than the listing", async () => {
    const { executable, cwd } = await fakeVendorCli(
      'echo "Try --model gpt-5-mini-preview for faster reviews"',
    );

    const result = await probeCliModelPolicy("copilot-cli", {
      executable,
      cwd,
      env: childEnv(),
      modelId: "gpt-5-mini",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.accepted).toBe(false);
  });

  it("accepts a model listed as an exact token", async () => {
    const { executable, cwd } = await fakeVendorCli('echo "gpt-5-mini\\nclaude-sonnet-4"');

    const result = await probeCliModelPolicy("copilot-cli", {
      executable,
      cwd,
      env: childEnv(),
      modelId: "gpt-5-mini",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.accepted).toBe(true);
  });

  it("fails closed when the model listing subcommand exits non-zero", async () => {
    const { executable, cwd } = await fakeVendorCli('echo "gpt-5-mini"; exit 3');

    const result = await probeCliModelPolicy("copilot-cli", {
      executable,
      cwd,
      env: childEnv(),
      modelId: "gpt-5-mini",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.accepted).toBe(false);
  });
});
