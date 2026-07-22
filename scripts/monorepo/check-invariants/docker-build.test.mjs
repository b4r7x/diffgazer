import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkDockerArtifactFormatterInputs,
  checkDockerFrozenInstallsCopyPatches,
  checkPnpmPinsMatchRootPackageManager,
} from "./docker.mjs";
import { createConformingFixture, FIXTURE_REPO_FILES, runFixture, writeText } from "./fixture.mjs";

test("Docker pnpm pins must match the root packageManager", () => {
  const root = createConformingFixture();
  writeText(root, "deploy/landing.Dockerfile", "RUN corepack prepare pnpm@10.28.2 --activate\n");

  const [result] = runFixture(root, { checks: [checkPnpmPinsMatchRootPackageManager] });

  assert.equal(result.ok, false);
  assert.match(result.details, /deploy\/landing\.Dockerfile/);
});

test("Docker artifact builds must copy formatter inputs", () => {
  const root = createConformingFixture();
  writeText(
    root,
    "deploy/landing.Dockerfile",
    ["COPY biome.json ./", "RUN corepack prepare pnpm@11.13.0 --activate", ""].join("\n"),
  );

  const [result] = runFixture(root, { checks: [checkDockerArtifactFormatterInputs] });

  assert.equal(result.ok, false);
  assert.match(result.details, /deploy\/landing\.Dockerfile: \.gitignore/);
});

test("Docker frozen installs must copy configured patches before installing", () => {
  const root = createConformingFixture();
  writeText(
    root,
    "deploy/landing.Dockerfile",
    [
      "COPY biome.json .gitignore ./",
      "RUN corepack prepare pnpm@11.13.0 --activate",
      "RUN pnpm install --frozen-lockfile",
      "COPY patches/ patches/",
      "",
    ].join("\n"),
  );

  const [result] = runFixture(root, { checks: [checkDockerFrozenInstallsCopyPatches] });

  assert.equal(result.ok, false);
  assert.match(
    result.details,
    /deploy\/landing\.Dockerfile: stage 0: patches\/nitro@3\.0\.260429-beta\.patch/,
  );
});

test("Docker patch validation rejects copies to a path pnpm does not read", () => {
  const root = createConformingFixture();
  writeText(
    root,
    "deploy/landing.Dockerfile",
    [
      "FROM node:22-alpine",
      "WORKDIR /app",
      "COPY patches/ /tmp/patches/",
      "RUN pnpm install --frozen-lockfile",
      "",
    ].join("\n"),
  );

  const [result] = runFixture(root, { checks: [checkDockerFrozenInstallsCopyPatches] });

  assert.equal(result.ok, false);
  assert.match(result.details, /deploy\/landing\.Dockerfile: stage 1/);
});

test("Docker patch validation retains the workdir where a relative copy occurred", () => {
  const root = createConformingFixture();
  writeText(
    root,
    "deploy/landing.Dockerfile",
    [
      "FROM node:22-alpine",
      "WORKDIR /app",
      "COPY patches/ patches/",
      "WORKDIR /other",
      "RUN pnpm install --frozen-lockfile",
      "",
    ].join("\n"),
  );

  const [result] = runFixture(root, { checks: [checkDockerFrozenInstallsCopyPatches] });

  assert.equal(result.ok, false);
  assert.match(result.details, /deploy\/landing\.Dockerfile: stage 1/);
});

test("Docker patch validation tracks a relative workdir after a copy", () => {
  const root = createConformingFixture();
  writeText(
    root,
    "deploy/landing.Dockerfile",
    [
      "FROM node:22-alpine",
      "COPY patches/ patches/",
      "WORKDIR app",
      "RUN pnpm install --frozen-lockfile",
      "",
    ].join("\n"),
  );

  const [result] = runFixture(root, { checks: [checkDockerFrozenInstallsCopyPatches] });

  assert.equal(result.ok, false);
  assert.match(result.details, /deploy\/landing\.Dockerfile: stage 1/);
});

for (const [caseName, runInstruction] of [
  ["chained command", "RUN cd /app && pnpm install --prod --frozen-lockfile"],
  ["BuildKit option", "RUN --mount=type=cache,target=/pnpm/store pnpm install --frozen-lockfile"],
  [
    "multiline command",
    ["RUN corepack enable && \\", "    pnpm install \\", "      --frozen-lockfile"].join("\n"),
  ],
  ["exec-form command", 'RUN ["pnpm", "install", "--prod", "--frozen-lockfile"]'],
]) {
  test(`Docker patch validation detects a frozen install in ${caseName}`, () => {
    const root = createConformingFixture();
    writeText(
      root,
      "deploy/landing.Dockerfile",
      [
        "FROM node:22-alpine",
        "COPY biome.json .gitignore ./",
        "RUN corepack prepare pnpm@11.13.0 --activate",
        runInstruction,
        "",
      ].join("\n"),
    );

    const [result] = runFixture(root, { checks: [checkDockerFrozenInstallsCopyPatches] });

    assert.equal(result.ok, false);
    assert.match(
      result.details,
      /deploy\/landing\.Dockerfile: stage 1: patches\/nitro@3\.0\.260429-beta\.patch/,
    );
  });
}

for (const runInstruction of [
  'RUN echo "pnpm install --frozen-lockfile"',
  "RUN pnpm install --frozen-lockfile=false",
]) {
  test(`Docker patch validation ignores non-install text: ${runInstruction}`, () => {
    const root = createConformingFixture();
    writeText(root, "deploy/landing.Dockerfile", `${runInstruction}\n`);

    const [result] = runFixture(root, { checks: [checkDockerFrozenInstallsCopyPatches] });

    assert.equal(result.ok, true);
  });
}

test("Docker patch validation discovers additional frozen-install Dockerfiles", () => {
  const root = createConformingFixture();
  const dockerfile = "deploy/preview.Dockerfile";
  writeText(
    root,
    dockerfile,
    ["FROM node:22-alpine", "RUN pnpm install --frozen-lockfile", ""].join("\n"),
  );

  const [result] = runFixture(root, {
    repoFiles: [...FIXTURE_REPO_FILES, dockerfile],
    checks: [checkDockerFrozenInstallsCopyPatches],
  });

  assert.equal(result.ok, false);
  assert.match(result.details, /deploy\/preview\.Dockerfile: stage 1/);
});

test("Docker patch validation resets copied inputs for every build stage", () => {
  const root = createConformingFixture();
  writeText(
    root,
    "deploy/landing.Dockerfile",
    [
      "FROM node:22-alpine AS first",
      "COPY patches/ patches/",
      "RUN pnpm install --frozen-lockfile",
      "FROM node:22-alpine AS second",
      "RUN pnpm install --frozen-lockfile",
      "",
    ].join("\n"),
  );

  const [result] = runFixture(root, { checks: [checkDockerFrozenInstallsCopyPatches] });

  assert.equal(result.ok, false);
  assert.match(result.details, /deploy\/landing\.Dockerfile: stage 2/);
  assert.doesNotMatch(result.details, /deploy\/landing\.Dockerfile: stage 1/);
});
