#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ENV } from "./artifacts/env.mjs";
import { readJson } from "./artifacts/json.mjs";
import { validateArtifactPackSurface } from "./artifacts/pack-surface.mjs";
import { runValidationChecks } from "./artifacts/run-checks.mjs";
import {
  collectArtifactSyncValidationErrors,
  getArtifactLibraries,
  readDocsLibrariesConfig,
} from "./artifacts/sync.mjs";
import {
  assertNoDuplicateDemoKeys,
  collectBundleRelativeJsImportErrors,
  collectTreeParityErrors,
  validateIntegrityBundle,
  validateLibraryArtifacts,
} from "./artifacts/validation.mjs";

const root = process.cwd();
const docsRoot = resolve(root, "apps/docs");

function loadWorkspaceArtifact(library) {
  const artifactRoot = resolve(root, library.workspaceDir, "dist/artifacts");
  const manifestPath = resolve(artifactRoot, "artifact-manifest.json");
  if (!existsSync(manifestPath)) return null;
  const manifest = readJson(manifestPath);
  return {
    id: library.id,
    artifactRoot,
    manifest,
    generatedFiles: Object.values(manifest.generated ?? {}),
  };
}

function registryItemToExportPath(item) {
  if (item.type === "registry:hook") return `./hooks/${item.name}`;
  if (item.type === "registry:lib") return `./lib/${item.name}`;
  return `./components/${item.name}`;
}

function collectExportTargets(value) {
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object") return [];
  return Object.values(value).flatMap(collectExportTargets);
}

function validatePackageExportTargets(packageDir, packageName) {
  const packageRoot = resolve(root, packageDir);
  const packageJson = readJson(resolve(packageRoot, "package.json"));
  const errors = [];

  for (const [exportPath, exportValue] of Object.entries(packageJson.exports ?? {})) {
    for (const target of collectExportTargets(exportValue)) {
      if (!target.startsWith("./")) continue;

      const targetPath = resolve(packageRoot, target);
      if (!existsSync(targetPath)) {
        errors.push(`${packageName} export ${exportPath} points to missing target: ${target}`);
      }
    }
  }

  return errors;
}

function validateUiPackageExports() {
  const packageJson = readJson(resolve(root, "libs/ui/package.json"));
  const registry = readJson(resolve(root, "libs/ui/registry/registry.json"));
  const actualExports = Object.keys(packageJson.exports ?? {}).sort();
  const hiddenExports = [];

  const registryExports = new Set();
  for (const item of registry.items ?? []) {
    if (item.type === "registry:theme") continue;

    const exportPath = registryItemToExportPath(item);
    if (item.meta?.hidden) {
      hiddenExports.push(exportPath);
      continue;
    }

    registryExports.add(exportPath);
  }

  registryExports.add("./components/logo/figlet");
  registryExports.add("./components/code-block/highlight");
  registryExports.add("./components/command-palette/highlight");
  registryExports.add("./lib/utils");
  registryExports.add("./theme-base.css");
  registryExports.add("./theme.css");
  registryExports.add("./sources.css");
  registryExports.add("./styles.css");
  registryExports.add("./package.json");

  const expectedExports = [...registryExports].sort();
  const errors = [];
  const missingExports = expectedExports.filter(
    (exportPath) => !actualExports.includes(exportPath),
  );
  const extraExports = actualExports.filter((exportPath) => !registryExports.has(exportPath));
  const exportedHiddenItems = hiddenExports.filter((exportPath) =>
    actualExports.includes(exportPath),
  );

  if (missingExports.length) {
    errors.push(
      `@diffgazer/ui package exports missing registry entries: ${missingExports.join(", ")}`,
    );
  }
  if (extraExports.length) {
    errors.push(
      `@diffgazer/ui package exports contain unsupported entries: ${extraExports.join(", ")}`,
    );
  }
  if (exportedHiddenItems.length) {
    errors.push(
      `@diffgazer/ui package exports expose hidden registry items: ${exportedHiddenItems.join(", ")}`,
    );
  }

  return errors;
}

function listPackedFiles(packageDir) {
  const output = execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
    cwd: resolve(root, packageDir),
    env: { ...process.env, npm_config_cache: resolve(root, "node_modules/.cache/npm-pack") },
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const packInfo = JSON.parse(output)[0];
  return (packInfo.files ?? []).map((file) => file.path.replace(/^package\//, ""));
}

function validateUiPackSurface(files) {
  const forbidden = [
    "dist/components/dialog-shell.",
    "dist/components/portal.",
    "dist/_types/registry/ui/shared/",
  ];
  const leaked = files.filter((path) => forbidden.some((prefix) => path.startsWith(prefix)));

  return leaked.length
    ? [`@diffgazer/ui npm pack includes forbidden runtime package files: ${leaked.join(", ")}`]
    : [];
}

function validateUiDeclarationsAvoidHiddenShared(packedFiles) {
  const errors = [];
  const packageRoot = resolve(root, "libs/ui");

  for (const relativePath of packedFiles) {
    if (!relativePath.endsWith(".d.ts")) continue;
    const absolute = resolve(packageRoot, relativePath);
    if (!existsSync(absolute)) continue;
    const source = readFileSync(absolute, "utf-8");
    if (/_types\/registry\/ui\/shared\//.test(source)) {
      errors.push(
        `@diffgazer/ui shipped declaration libs/ui/${relativePath} references hidden _types/registry/ui/shared path`,
      );
    }
  }

  return errors;
}

function packageFilesNeedTrackedPolicyCheck() {
  return process.env[ENV.ci] === "true" || process.env[ENV.requireTrackedPolicy] === "1";
}

function gitTrackedFiles(paths) {
  if (!paths.length) return new Set();

  const output = execFileSync("git", ["ls-files", "--", ...paths], {
    cwd: root,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  return new Set(output.trim().split("\n").filter(Boolean));
}

function validatePackagePolicyFiles() {
  const packages = [
    { dir: ".", name: "@diffgazer/repo" },
    { dir: "cli/add", name: "@diffgazer/add" },
    { dir: "cli/diffgazer", name: "diffgazer" },
    { dir: "libs/keys", name: "@diffgazer/keys" },
    { dir: "libs/ui", name: "@diffgazer/ui" },
  ];
  const policyFiles = [];
  const errors = [];

  for (const pkg of packages) {
    const manifest = readJson(resolve(root, pkg.dir, "package.json"));
    for (const file of ["SECURITY.md", "SUPPORT.md"]) {
      if (!manifest.files?.includes(file) && pkg.dir !== ".") continue;

      const relativePath = pkg.dir === "." ? file : `${pkg.dir}/${file}`;
      policyFiles.push(relativePath);
      if (!existsSync(resolve(root, relativePath))) {
        errors.push(
          `${pkg.name} package policy file is listed or required but missing: ${relativePath}`,
        );
      }
    }
  }

  if (packageFilesNeedTrackedPolicyCheck()) {
    const tracked = gitTrackedFiles(policyFiles);
    const untracked = policyFiles.filter((file) => !tracked.has(file));
    if (untracked.length) {
      errors.push(`package policy files must be tracked in git: ${untracked.join(", ")}`);
    }
  }

  return errors;
}

const docsLibraries = readDocsLibrariesConfig(resolve(docsRoot, "config/docs-libraries.json"));
const artifactLibraries = getArtifactLibraries(docsLibraries);
const packedFilesByPackage = new Map(
  artifactLibraries.map((library) => [library.packageName, listPackedFiles(library.workspaceDir)]),
);
const uiPackedFiles = packedFilesByPackage.get("@diffgazer/ui") ?? [];

const checks = [
  ...validateLibraryArtifacts({
    rootDir: resolve(root, "libs/ui"),
    label: "@diffgazer/ui",
  }),
  ...validateLibraryArtifacts({
    rootDir: resolve(root, "libs/keys"),
    label: "@diffgazer/keys",
  }),
  ...collectTreeParityErrors(
    resolve(root, "libs/keys/dist/artifacts"),
    resolve(root, "libs/keys/artifacts/dist/artifacts"),
    "@diffgazer/keys-artifacts mirror",
  ),
  ...validateIntegrityBundle(
    resolve(root, "cli/add/src/generated/keys-copy-bundle.json"),
    ["items"],
    "@diffgazer/add keys copy bundle",
  ),
  ...validateIntegrityBundle(
    resolve(root, "cli/add/src/generated/registry-bundle.json"),
    ["items", "theme", "styles"],
    "@diffgazer/add registry bundle",
  ),
  ...collectTreeParityErrors(
    resolve(root, "cli/add/src/generated"),
    resolve(root, "cli/add/dist/generated"),
    "@diffgazer/add dist generated",
  ),
  ...validatePackageExportTargets("libs/ui", "@diffgazer/ui"),
  ...validateUiPackageExports(),
  ...artifactLibraries.flatMap((library) =>
    validateArtifactPackSurface(root, library, packedFilesByPackage.get(library.packageName) ?? []),
  ),
  ...validateUiPackSurface(uiPackedFiles),
  ...validateUiDeclarationsAvoidHiddenShared(uiPackedFiles),
  ...validatePackagePolicyFiles(),
];

checks.push(
  ...collectArtifactSyncValidationErrors({
    docsRoot,
    primaryLibraryId: docsLibraries.primaryLibraryId,
    libraries: artifactLibraries,
    artifacts: artifactLibraries.map(loadWorkspaceArtifact).filter(Boolean),
  }),
);

const registryBundle = readJson(resolve(root, "cli/add/src/generated/registry-bundle.json"));
checks.push(
  ...assertNoDuplicateDemoKeys(registryBundle.items ?? [], "@diffgazer/add registry bundle"),
);

const keysCopyBundle = readJson(resolve(root, "cli/add/src/generated/keys-copy-bundle.json"));
checks.push(
  ...collectBundleRelativeJsImportErrors(registryBundle.items, "@diffgazer/add registry bundle"),
);
checks.push(
  ...collectBundleRelativeJsImportErrors(keysCopyBundle.items, "@diffgazer/add keys copy bundle"),
);

// Exit-code contract: this validator exits non-zero when any check fails so CI
// gates can branch on it. The shared runner reports failures and exits 1
// explicitly rather than relying on an uncaught throw.
runValidationChecks(checks, {
  failureHeader: "Artifact validation failed.",
  successMessage: "OK: artifact validation passed",
});
