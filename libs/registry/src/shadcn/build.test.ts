import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setupRegistry } from "../testing/shadcn-registry-fixture.js";
import { aggregateThemeStyles } from "./build.js";

describe("aggregateThemeStyles", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "rk-shadcn-styles-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("appends a shared CSS source once in first-seen order", () => {
    const sharedPath = "registry/ui/shared/stepper.css";
    setupRegistry(tempDir, [
      { name: "stepper", files: [{ path: sharedPath }] },
      { name: "stepper-trigger", files: [{ path: sharedPath }] },
      { name: "stepper-content", files: [{ path: sharedPath }] },
    ]);
    writeFileSync(resolve(tempDir, sharedPath), "/* shared-stepper */\n");

    const styles = aggregateThemeStyles({
      rootDir: tempDir,
      sourceRegistryPath: "registry/registry.json",
      seedContent: "/* seed */\n",
    });

    expect(styles.match(/shared-stepper/g)).toHaveLength(1);
    expect(styles.indexOf("seed")).toBeLessThan(styles.indexOf("shared-stepper"));
  });
});
