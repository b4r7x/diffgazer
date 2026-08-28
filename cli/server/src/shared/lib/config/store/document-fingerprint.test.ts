import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getGlobalConfigPath, getGlobalSecretsPath } from "../../paths.js";
import { assertTempHome } from "../../testing/temp-home.js";
import { getSecretsRecoveryPath } from "../persistence/secrets-recovery.js";
import { captureDocumentFingerprints, sameDocumentFingerprints } from "./document-fingerprint.js";

const { inodelessPaths } = vi.hoisted(() => ({ inodelessPaths: new Set<string>() }));

// FAT/exFAT report no inode. No temp directory can be mounted that way from a test,
// so the only way to reach that filesystem is to answer `statSync` the way it does.
vi.mock("node:fs", async (importOriginal) => {
  const real = await importOriginal<typeof import("node:fs")>();
  const statSync = ((...args: Parameters<typeof real.statSync>) => {
    const stat = real.statSync(...args);
    return inodelessPaths.has(String(args[0])) ? { ...stat, ino: 0 } : stat;
  }) as typeof real.statSync;
  return { ...real, statSync, default: { ...real, statSync } };
});

const documentNames = ["config", "secrets", "recovery"] as const;

const documentPaths = () => ({
  config: getGlobalConfigPath(),
  secrets: getGlobalSecretsPath(),
  recovery: getSecretsRecoveryPath(),
});

const writeEveryDocument = (): void => {
  for (const filePath of Object.values(documentPaths())) {
    writeFileSync(filePath, "{}\n", { mode: 0o600 });
  }
};

let diffgazerHome: string;

beforeEach(() => {
  diffgazerHome = mkdtempSync(join(tmpdir(), "diffgazer-fingerprint-"));
  assertTempHome(diffgazerHome);
  process.env.DIFFGAZER_HOME = diffgazerHome;
  inodelessPaths.clear();
});

afterEach(() => {
  inodelessPaths.clear();
  rmSync(diffgazerHome, { recursive: true, force: true });
  delete process.env.DIFFGAZER_HOME;
});

describe("config document fingerprints", () => {
  it("matches two captures of a home where no document exists yet", () => {
    expect(
      sameDocumentFingerprints(captureDocumentFingerprints(), captureDocumentFingerprints()),
    ).toBe(true);
  });

  it("matches two captures while every document sits still", () => {
    writeEveryDocument();

    expect(
      sameDocumentFingerprints(captureDocumentFingerprints(), captureDocumentFingerprints()),
    ).toBe(true);
  });

  for (const document of documentNames) {
    it(`refuses to vouch for an untouched ${document} document without an inode`, () => {
      writeEveryDocument();
      inodelessPaths.add(documentPaths()[document]);

      // Size and two coarse timestamps cannot rule out a replacement inside one
      // timestamp tick, so even a file nobody touched is never vouched for.
      expect(
        sameDocumentFingerprints(captureDocumentFingerprints(), captureDocumentFingerprints()),
      ).toBe(false);
    });
  }
});
