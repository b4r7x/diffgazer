import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildSnapshotContent } from "./content.js";

let projectRoot: string;

beforeEach(async () => {
  projectRoot = await realpath(await mkdtemp(join(tmpdir(), "diffgazer-context-")));
});

afterEach(async () => {
  await rm(projectRoot, { recursive: true, force: true });
});

function buildContent() {
  return buildSnapshotContent({
    projectPath: projectRoot,
    normalizedRoot: projectRoot,
    statusHash: "status-hash",
    statusHashKind: "full",
    headCommit: "abc1234",
  });
}

describe("buildSnapshotContent", () => {
  it("includes an excerpt of the project README", async () => {
    await writeFile(join(projectRoot, "README.md"), "# Fixture\n\nA short readme.\n", "utf8");

    const snapshot = await buildContent();

    expect(snapshot.markdown).toContain("## README (excerpt)");
    expect(snapshot.markdown).toContain("A short readme.");
  });

  it("omits the README excerpt for a file past the read ceiling instead of loading it whole", async () => {
    const oversizeReadme = `# Fixture\n${"padding line\n".repeat(30_000)}`;
    await writeFile(join(projectRoot, "README.md"), oversizeReadme, "utf8");

    const snapshot = await buildContent();

    expect(snapshot.markdown).not.toContain("## README (excerpt)");
    expect(snapshot.markdown).toContain("# Project Context Snapshot");
  });

  it("reports a package.json past the read ceiling as missing rather than parsing it", async () => {
    await writeFile(
      join(projectRoot, "package.json"),
      JSON.stringify({ name: "fixture-root", description: "x".repeat(300_000) }),
      "utf8",
    );

    const snapshot = await buildContent();

    expect(snapshot.markdown).toContain("package.json not found.");
    expect(snapshot.markdown).not.toContain("fixture-root");
  });
});
