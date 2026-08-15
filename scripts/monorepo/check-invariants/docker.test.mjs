import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkDockerArtifactFormatterInputs,
  checkDockerCopiesWorkspaceManifests,
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

test("Docker patch validation skips JSON exec-form RUN instead of misreading it", () => {
  const root = createConformingFixture();
  writeText(
    root,
    "deploy/landing.Dockerfile",
    [
      "FROM node:22-alpine",
      "WORKDIR /app",
      // Exec form runs no shell, so the shell-form parser does not describe it.
      // It is out of scope, not a violation to be guessed at.
      'RUN ["pnpm", "install", "--frozen-lockfile"]',
      "",
    ].join("\n"),
  );

  const [result] = runFixture(root, { checks: [checkDockerFrozenInstallsCopyPatches] });

  assert.equal(result.ok, true);
});

test("Docker COPY parsing skips JSON exec form rather than splitting it on whitespace", () => {
  const root = createConformingFixture();
  writeText(
    root,
    "deploy/landing.Dockerfile",
    [
      "FROM node:22-alpine",
      // Exec form is out of scope, so it credits nothing: the parser must
      // report both inputs missing rather than register the bracketed tokens
      // (`["biome.json",` and friends) as if they were real sources.
      'COPY ["biome.json", ".gitignore", "./"]',
      "",
    ].join("\n"),
  );

  const [result] = runFixture(root, { checks: [checkDockerArtifactFormatterInputs] });

  assert.equal(result.ok, false);
  assert.match(result.details, /deploy\/landing\.Dockerfile: biome\.json/);
  assert.match(result.details, /deploy\/landing\.Dockerfile: \.gitignore/);
});

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

const MANIFEST_DOCKERFILE_LINES = [
  "FROM node:22-alpine",
  "WORKDIR /app",
  "COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./",
  "COPY apps/docs/package.json apps/docs/package.json",
  "COPY libs/keys/examples/playground/package.json libs/keys/examples/playground/package.json",
  "RUN pnpm fetch --frozen-lockfile",
  "RUN pnpm install --frozen-lockfile --offline",
  "",
];

const MANIFEST_REPO_FILES = [
  ...FIXTURE_REPO_FILES,
  "apps/docs/package.json",
  "libs/keys/examples/playground/package.json",
];

test("Docker offline installs accept a Dockerfile that copies every workspace manifest", () => {
  const root = createConformingFixture();
  for (const file of FIXTURE_REPO_FILES) {
    writeText(root, file, MANIFEST_DOCKERFILE_LINES.join("\n"));
  }

  const [result] = runFixture(root, {
    repoFiles: MANIFEST_REPO_FILES,
    checks: [checkDockerCopiesWorkspaceManifests],
  });

  assert.equal(result.ok, true);
});

test("Docker offline installs reject a workspace manifest added after the image was written", () => {
  const root = createConformingFixture();
  for (const file of FIXTURE_REPO_FILES) {
    writeText(root, file, MANIFEST_DOCKERFILE_LINES.join("\n"));
  }

  const [result] = runFixture(root, {
    repoFiles: [...MANIFEST_REPO_FILES, "libs/newthing/package.json"],
    checks: [checkDockerCopiesWorkspaceManifests],
  });

  assert.equal(result.ok, false);
  assert.match(result.details, /Dockerfile: stage 1: libs\/newthing\/package\.json/);
  assert.match(
    result.details,
    /deploy\/landing\.Dockerfile: stage 1: libs\/newthing\/package\.json/,
  );
});

test("Docker manifest validation only requires manifests the workspace globs claim", () => {
  const root = createConformingFixture();
  for (const file of FIXTURE_REPO_FILES) {
    writeText(root, file, MANIFEST_DOCKERFILE_LINES.join("\n"));
  }

  const [result] = runFixture(root, {
    repoFiles: [...MANIFEST_REPO_FILES, "scripts/fixtures/sample/package.json"],
    checks: [checkDockerCopiesWorkspaceManifests],
  });

  assert.equal(result.ok, true);
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
