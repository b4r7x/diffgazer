import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PROJECT_ROOT_HEADER } from "@diffgazer/core/api/protocol";
import { describe, expect, it } from "vitest";
import {
  configureSetup,
  createReviewApp,
  installGitServiceMock,
  requestOptions,
  setupReviewRouterHarness,
} from "../testing/router-harness.js";

const harness = setupReviewRouterHarness();

async function writeContextSnapshot(
  contextDir: string,
  root: string,
  markdown: string,
): Promise<void> {
  const graph = {
    generatedAt: "2025-01-01",
    root,
    packages: [],
    edges: [],
    fileTree: [],
    changedFiles: [],
  };
  const meta = {
    generatedAt: "2025-01-01",
    root,
    statusHash: "status",
    statusHashKind: "full",
    charCount: markdown.length,
  };
  const generation = "router-fixture";
  const markdownFile = `context.${generation}.md`;
  const graphFile = `context.${generation}.json`;
  const metaFile = `context.${generation}.meta.json`;
  const graphContent = JSON.stringify(graph);
  const metaContent = JSON.stringify(meta);
  const sha256 = (content: string) => createHash("sha256").update(content).digest("hex");
  await writeFile(join(contextDir, markdownFile), markdown, "utf-8");
  await writeFile(join(contextDir, graphFile), graphContent, "utf-8");
  await writeFile(join(contextDir, metaFile), metaContent, "utf-8");
  await writeFile(
    join(contextDir, "context.manifest.json"),
    JSON.stringify({
      version: 1,
      generation,
      artifacts: {
        markdown: { file: markdownFile, sha256: sha256(markdown) },
        graph: { file: graphFile, sha256: sha256(graphContent) },
        meta: { file: metaFile, sha256: sha256(metaContent) },
      },
    }),
    "utf-8",
  );
}

describe("GET /api/review/context read-path security", () => {
  it("serves a cached snapshot whose stored root matches the project", async () => {
    await configureSetup(harness.projectA);
    const contextDir = join(harness.projectA, ".diffgazer");
    await mkdir(contextDir, { recursive: true });
    await writeContextSnapshot(contextDir, harness.projectA, "# current project context");
    const app = await createReviewApp();

    const response = await app.request("/api/review/context", requestOptions(harness.projectA));
    const body = (await response.json()) as { text: string; markdown: string };

    expect(response.status).toBe(200);
    expect(body.markdown).toContain("# current project context");
    expect(body.text).toContain("current project context");
    expect(body.text).not.toContain("# current project context");
  });

  it("returns 404 for a snapshot whose stored root belongs to a different checkout", async () => {
    await configureSetup(harness.projectA);
    const contextDir = join(harness.projectA, ".diffgazer");
    await mkdir(contextDir, { recursive: true });
    await writeContextSnapshot(contextDir, harness.projectB, "# foreign checkout context");
    const app = await createReviewApp();

    const response = await app.request("/api/review/context", requestOptions(harness.projectA));
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it.skipIf(process.platform === "win32")(
    "does not serve context files through a symlinked .diffgazer directory",
    async () => {
      const outsideRoot = await mkdtemp(join(tmpdir(), "diffgazer-review-router-outside-"));
      try {
        // Setup writes trust through a real `.diffgazer`; relocating that state
        // behind a symlink afterwards leaves a trusted project whose context
        // now resolves outside the checkout.
        await configureSetup(harness.projectA);
        const contextDir = join(harness.projectA, ".diffgazer");
        await rm(outsideRoot, { recursive: true, force: true });
        await rename(contextDir, outsideRoot);
        await symlink(outsideRoot, contextDir);
        await writeContextSnapshot(outsideRoot, harness.projectA, "SECRET_EXTERNAL_CONTEXT_MARKER");
        const app = await createReviewApp();

        const response = await app.request("/api/review/context", requestOptions(harness.projectA));
        const text = await response.text();

        // The symlinked state directory fails project resolution outright, so the
        // request is refused before any context artifact is read.
        expect(response.status).toBe(403);
        expect(text).not.toContain("SECRET_EXTERNAL_CONTEXT_MARKER");
      } finally {
        await rm(outsideRoot, { recursive: true, force: true });
      }
    },
  );
});

describe("POST /api/review/context/refresh", () => {
  it("rebuilds the cached snapshot from the changed package marker when forced", async () => {
    await configureSetup(harness.projectA);
    installGitServiceMock();
    await writeFile(
      join(harness.projectA, "package.json"),
      JSON.stringify({ name: "first", version: "1.0.0" }),
      "utf-8",
    );
    const app = await createReviewApp();

    const seed = await app.request("/api/review/context/refresh", {
      method: "POST",
      headers: {
        [PROJECT_ROOT_HEADER]: harness.projectA,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    const seeded = (await seed.json()) as { markdown: string };
    expect(seed.status).toBe(200);
    expect(seeded.markdown).toContain("- Name: first");

    await writeFile(
      join(harness.projectA, "package.json"),
      JSON.stringify({ name: "second", version: "1.0.0" }),
      "utf-8",
    );

    const response = await app.request("/api/review/context/refresh", {
      method: "POST",
      headers: {
        [PROJECT_ROOT_HEADER]: harness.projectA,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ force: true }),
    });
    const body = (await response.json()) as { markdown: string };

    expect(response.status).toBe(200);
    expect(body.markdown).toContain("- Name: second");
  });

  it("returns 429 with Retry-After once the forced-refresh budget is spent", async () => {
    const { resetRateLimitsForTests } = await import("../../../shared/middlewares/rate-limit.js");
    resetRateLimitsForTests();
    await configureSetup(harness.projectA);
    installGitServiceMock();
    const app = await createReviewApp();

    const refresh = () =>
      app.request("/api/review/context/refresh", {
        method: "POST",
        headers: {
          [PROJECT_ROOT_HEADER]: harness.projectA,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ force: true }),
      });

    let response = await refresh();
    for (let i = 0; i < 5; i++) {
      response = await refresh();
    }

    expect(response.status).toBe(429);
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("RATE_LIMITED");
  });
});
