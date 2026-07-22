import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../..");
const DOCS_ROOT = resolve(REPO_ROOT, "apps/docs");

function copyFixturePath(source, target) {
  mkdirSync(dirname(target), { recursive: true });
  cpSync(source, target, { recursive: true });
}

function runTypeScript(script, args, cwd, env = process.env) {
  return spawnSync(process.execPath, ["--import", "tsx", script, ...args], {
    cwd,
    encoding: "utf8",
    env,
  });
}

function writeLlmsSourceFixtures(docsRoot) {
  const generatedRoot = join(docsRoot, "src/generated");
  const sourceRoot = join(docsRoot, "public/source-data");
  const sourceFile = {
    raw: "export const fixture = true;\n",
    highlighted: [],
  };

  for (const [library, type] of [
    ["ui", "components"],
    ["ui", "hooks"],
    ["keys", "hooks"],
  ]) {
    for (const entry of readdirSync(join(generatedRoot, library, type), {
      withFileTypes: true,
    })) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      const name = entry.name.slice(0, -".json".length);
      const artifact =
        type === "components"
          ? { source: { [`${name}.tsx`]: sourceFile }, mergedSource: sourceFile.raw }
          : { source: sourceFile, files: [{ path: `${name}.ts`, ...sourceFile }] };
      const outputPath = join(sourceRoot, library, type, `${name}.source.json`);
      mkdirSync(dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, `${JSON.stringify(artifact)}\n`);
    }
  }
}

test(
  "runs every direct build and validation entrypoint from a checkout path with spaces and Unicode",
  { timeout: 30_000 },
  () => {
    const checkoutRoot = mkdtempSync(join(tmpdir(), "diffgazer checkout ą-"));
    const fixtureDocs = join(checkoutRoot, "apps/docs");
    const fixtureKeys = join(checkoutRoot, "libs/keys");
    const outputDir = join(fixtureDocs, ".output/public");

    try {
      symlinkSync(join(REPO_ROOT, "node_modules"), join(checkoutRoot, "node_modules"), "dir");
      mkdirSync(fixtureDocs, { recursive: true });
      symlinkSync(join(DOCS_ROOT, "node_modules"), join(fixtureDocs, "node_modules"), "dir");
      mkdirSync(join(checkoutRoot, "libs"), { recursive: true });
      symlinkSync(join(REPO_ROOT, "libs/registry"), join(checkoutRoot, "libs/registry"), "dir");
      writeFileSync(
        join(checkoutRoot, "package.json"),
        '{"name":"fixture","private":true,"type":"module"}\n',
      );
      for (const path of [
        "scripts",
        "config",
        "content",
        "src/generated",
        "src/lib",
        "src/types",
      ]) {
        copyFixturePath(join(DOCS_ROOT, path), join(fixtureDocs, path));
      }
      writeLlmsSourceFixtures(fixtureDocs);

      const sitemapScript = join(fixtureDocs, "scripts/generate-sitemap.ts");
      const llmsScript = join(fixtureDocs, "scripts/generate-llms.ts");
      const linkScript = join(fixtureDocs, "scripts/check-internal-links.ts");
      const sitemap = runTypeScript(sitemapScript, [outputDir], fixtureDocs);
      const llms = runTypeScript(llmsScript, [outputDir], fixtureDocs);

      assert.equal(sitemap.status, 0, sitemap.stderr);
      assert.equal(llms.status, 0, llms.stderr);
      assert.ok(existsSync(join(outputDir, "sitemap.xml")));
      assert.ok(existsSync(join(outputDir, "robots.txt")));
      assert.ok(existsSync(join(outputDir, "llms.txt")));
      assert.ok(existsSync(join(outputDir, "llms-full.txt")));
      assert.ok(
        readFileSync(join(outputDir, "llms-full.txt"), "utf8").includes(
          "export const fixture = true;",
        ),
      );

      const brokenPage = join(fixtureDocs, "content/docs/app/getting-started/installation.mdx");
      writeFileSync(
        brokenPage,
        `${readFileSync(brokenPage, "utf8")}\n[Broken fixture](/entrypoint-mutant)\n`,
      );
      const linkCheck = runTypeScript(linkScript, [], fixtureDocs);
      assert.notEqual(linkCheck.status, 0);
      assert.ok(linkCheck.stderr.includes("/entrypoint-mutant"));

      copyFixturePath(
        join(REPO_ROOT, "libs/keys/scripts/validate-registry-closure.ts"),
        join(fixtureKeys, "scripts/validate-registry-closure.ts"),
      );
      copyFixturePath(
        join(REPO_ROOT, "libs/keys/scripts/validate-registry-closure"),
        join(fixtureKeys, "scripts/validate-registry-closure"),
      );
      copyFixturePath(
        join(REPO_ROOT, "libs/keys/scripts/transform-public-registry-imports.ts"),
        join(fixtureKeys, "scripts/transform-public-registry-imports.ts"),
      );
      copyFixturePath(join(REPO_ROOT, "libs/keys/registry"), join(fixtureKeys, "registry"));
      copyFixturePath(join(REPO_ROOT, "libs/keys/public"), join(fixtureKeys, "public"));

      const registryPath = join(fixtureKeys, "registry/registry.json");
      const registry = JSON.parse(readFileSync(registryPath, "utf8"));
      const hook = registry.items.find((item) => item.type === "registry:hook");
      if (!hook) throw new Error("Fixture registry has no hook item");
      hook.files = [{ path: "src/hooks/missing-entrypoint-fixture.ts", type: "registry:hook" }];
      writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);

      const keysCheck = runTypeScript(
        join(fixtureKeys, "scripts/validate-registry-closure.ts"),
        [],
        fixtureKeys,
      );
      assert.notEqual(keysCheck.status, 0);
      assert.ok(keysCheck.stderr.includes("missing-entrypoint-fixture.ts"));

      copyFixturePath(
        join(REPO_ROOT, "scripts/monorepo/guard-publish.mjs"),
        join(checkoutRoot, "scripts/monorepo/guard-publish.mjs"),
      );
      copyFixturePath(
        join(REPO_ROOT, "scripts/monorepo/lib"),
        join(checkoutRoot, "scripts/monorepo/lib"),
      );
      mkdirSync(join(checkoutRoot, "packages/blocked"), { recursive: true });
      writeFileSync(
        join(checkoutRoot, "packages/blocked/package.json"),
        '{"name":"@fixture/blocked","version":"1.0.0"}\n',
      );
      const fakeBin = join(checkoutRoot, ".bin");
      mkdirSync(fakeBin);
      const fakeNpm = join(fakeBin, "npm");
      writeFileSync(fakeNpm, '#!/bin/sh\necho "npm ERR! E404 Not Found" >&2\nexit 1\n');
      chmodSync(fakeNpm, 0o755);
      execFileSync("git", ["init", "-q"], { cwd: checkoutRoot });
      execFileSync("git", ["add", "."], { cwd: checkoutRoot });
      const gitIdentity = ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.com"];
      execFileSync("git", [...gitIdentity, "commit", "-qm", "fixture baseline"], {
        cwd: checkoutRoot,
      });
      execFileSync("git", [...gitIdentity, "commit", "--allow-empty", "-qm", "fixture head"], {
        cwd: checkoutRoot,
      });

      const publishGuard = spawnSync(
        process.execPath,
        [join(checkoutRoot, "scripts/monorepo/guard-publish.mjs")],
        {
          cwd: checkoutRoot,
          encoding: "utf8",
          env: { ...process.env, PATH: `${fakeBin}:${process.env.PATH ?? ""}` },
        },
      );
      assert.equal(publishGuard.status, 0, publishGuard.stderr);
      assert.ok(publishGuard.stdout.includes("no eligible package versions need publication"));
      assert.equal(publishGuard.stderr, "");
    } finally {
      rmSync(checkoutRoot, { recursive: true, force: true });
    }
  },
);
