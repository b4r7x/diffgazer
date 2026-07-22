import { readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { homePath, readJson, tempHome, writeJson } from "./persistence.test-support.js";

import "./persistence.test-support.js";

describe("trust persistence", () => {
  it("loads default trust when no file exists", async () => {
    const { loadTrust } = await import("./trust.js");
    expect(loadTrust()).toEqual({ projects: {} });
  });

  it("merges trust.json at record granularity so an external trust record survives persist", async () => {
    const { persistTrustRecordAsync } = await import("./trust.js");
    await writeJson("trust.json", {
      projects: {
        "proj-external": {
          projectId: "proj-external",
          repoRoot: "/projects/external",
          trustedAt: "2024-01-01T00:00:00.000Z",
          capabilities: { readFiles: true, runCommands: false },
          trustMode: "persistent",
        },
      },
    });

    await persistTrustRecordAsync({
      projectId: "proj-mine",
      repoRoot: "/projects/mine",
      trustedAt: "2024-01-02T00:00:00.000Z",
      capabilities: { readFiles: true, runCommands: false },
      trustMode: "persistent",
    });

    const persisted = await readJson<{ projects: Record<string, unknown> }>(
      homePath("trust.json"),
    );
    expect(Object.keys(persisted.projects).sort()).toEqual(["proj-external", "proj-mine"]);
  });

  it("validates trust records and drops invalid entries while preserving valid ones", async () => {
    await writeJson("trust.json", {
      projects: {
        "proj-1": {
          projectId: "proj-1",
          projectPath: "/proj-1",
          capabilities: null,
        },
        "proj-2": {
          projectId: "proj-2",
          repoRoot: "/proj-2",
          trustedAt: "2024-01-01T00:00:00.000Z",
          capabilities: { readFiles: true, runCommands: false },
          trustMode: "persistent",
        },
      },
    });
    const { loadTrust } = await import("./trust.js");

    const trust = loadTrust();
    expect(trust.projects["proj-1"]).toBeUndefined();
    expect(trust.projects["proj-2"]).toMatchObject({
      capabilities: { readFiles: true, runCommands: false },
    });
  });

  it("quarantines malformed trust top-level data", async () => {
    await writeJson("trust.json", { projects: [] });
    const { loadTrust } = await import("./trust.js");

    expect(loadTrust()).toEqual({ projects: {} });
    const files = await readdir(tempHome);
    expect(files.some((file) => /^trust\.json\..+\.backup$/.test(file))).toBe(true);
  });

  it("persists trust as a real JSON file", async () => {
    const { persistTrust } = await import("./trust.js");

    persistTrust({ projects: {} });

    await expect(readJson(homePath("trust.json"))).resolves.toEqual({ projects: {} });
  });

  it("drops reserved project IDs from trust records", async () => {
    await writeJson("trust.json", {
      projects: {
        constructor: {
          projectId: "constructor",
          repoRoot: "/projects/one",
          trustedAt: "2024-01-01T00:00:00.000Z",
          capabilities: { readFiles: true, runCommands: false },
          trustMode: "persistent",
        },
        "proj-valid": {
          projectId: "proj-valid",
          repoRoot: "/projects/two",
          trustedAt: "2024-01-01T00:00:00.000Z",
          capabilities: { readFiles: true, runCommands: false },
          trustMode: "persistent",
        },
      },
    });
    const { loadTrust } = await import("./trust.js");

    expect(loadTrust().projects).toEqual({
      "proj-valid": expect.objectContaining({ projectId: "proj-valid" }),
    });
  });
});
