import { existsInRoot, invariantResult, readJsonInRoot, readTextInRoot } from "./context.mjs";

const LICENSE_MARKERS = {
  MIT: "MIT License",
  "Apache-2.0": "Apache License",
};

export { LICENSE_MARKERS };

const PUBLISHABLE_PACKAGE_FILES = [
  "cli/add/package.json",
  "cli/diffgazer/package.json",
  "libs/keys/package.json",
  "libs/ui/package.json",
];

export { PUBLISHABLE_PACKAGE_FILES };

const EXPECTED_WORKSPACE_PACKAGE_FILES = [
  "apps/docs/package.json",
  "apps/landing/package.json",
  "apps/web/package.json",
  "cli/add/package.json",
  "cli/diffgazer/package.json",
  "cli/server/package.json",
  "libs/core/package.json",
  "libs/keys/package.json",
  "libs/registry/package.json",
  "libs/ui/package.json",
];

const ALLOWED_NESTED_PACKAGE_FILES = [
  "libs/keys/artifacts/package.json",
  "libs/keys/examples/playground/package.json",
];

function ensureContainsFiles(fileList, required) {
  const normalized = Array.isArray(fileList) ? fileList : [];
  const missing = required.filter((name) => !normalized.includes(name));
  return { ok: missing.length === 0, missing };
}

function checkPolicyFiles(context, pkgJsonPath, missing) {
  const readmePath = pkgJsonPath.replace(/package\.json$/, "README.md");
  if (!existsInRoot(context, readmePath)) {
    missing.push(`README missing: ${readmePath}`);
  }
  for (const policyFile of ["SECURITY.md", "SUPPORT.md"]) {
    const policyPath = pkgJsonPath.replace(/package\.json$/, policyFile);
    if (!existsInRoot(context, policyPath)) {
      missing.push(`${policyFile} missing: ${policyPath}`);
    }
  }
}

function hasExport(exportsKeys, expectedExport) {
  if (!expectedExport.endsWith("/*")) {
    return exportsKeys.includes(expectedExport);
  }

  const prefix = expectedExport.slice(0, -1);
  return exportsKeys.some((name) => name.startsWith(prefix) && !name.includes("*"));
}

function checkPackageMetadata(
  context,
  {
    path,
    expectedName,
    expectedHomePageSuffix,
    expectedRepoDir,
    expectedExports,
    expectedFiles,
    expectedSideEffects,
  },
) {
  const pkg = readJsonInRoot(context, path);
  const missing = [];

  if (pkg.name !== expectedName) {
    missing.push(`name: ${pkg.name}`);
  }
  if (pkg.homepage && !pkg.homepage.includes(expectedHomePageSuffix)) {
    missing.push(`homepage: ${pkg.homepage}`);
  }
  const repoDir = pkg.repository?.directory;
  if (repoDir !== expectedRepoDir) {
    missing.push(`repository.directory: ${repoDir}`);
  }
  if (JSON.stringify(pkg.sideEffects) !== JSON.stringify(expectedSideEffects)) {
    missing.push(`sideEffects: ${JSON.stringify(pkg.sideEffects)}`);
  }

  const fileCheck = ensureContainsFiles(pkg.files, expectedFiles);
  if (!fileCheck.ok) {
    missing.push(`files missing: ${fileCheck.missing.join(", ")}`);
  }

  const exportsKeys = pkg.exports ? Object.keys(pkg.exports) : [];
  const wildcardExports = exportsKeys.filter((name) => name.includes("*"));
  if (wildcardExports.length) {
    missing.push(`wildcard exports: ${wildcardExports.join(", ")}`);
  }

  const missingExports = expectedExports.filter((name) => !hasExport(exportsKeys, name));
  if (missingExports.length) {
    missing.push(`exports missing: ${missingExports.join(", ")}`);
  }

  checkPolicyFiles(context, path, missing);

  return invariantResult(`${path}: package metadata`, missing.length === 0, missing.join("; "));
}

function checkCliPackageMetadata(
  context,
  { path, expectedName, expectedBinName, expectedRepoDir, expectedFiles },
) {
  const pkg = readJsonInRoot(context, path);
  const missing = [];

  if (pkg.name !== expectedName) {
    missing.push(`name: ${pkg.name}`);
  }
  if (pkg.private) {
    missing.push("private: true");
  }
  if (pkg.bin?.[expectedBinName] == null) {
    missing.push(`bin missing: ${expectedBinName}`);
  }
  const repoDir = pkg.repository?.directory;
  if (repoDir !== expectedRepoDir) {
    missing.push(`repository.directory: ${repoDir}`);
  }
  if (pkg.repository?.url && !pkg.repository.url.includes("github.com/b4r7x/diffgazer")) {
    missing.push(`repository.url: ${pkg.repository.url}`);
  }
  if (pkg.homepage && !pkg.homepage.includes(expectedRepoDir)) {
    missing.push(`homepage: ${pkg.homepage}`);
  }

  const fileCheck = ensureContainsFiles(pkg.files, expectedFiles);
  if (!fileCheck.ok) {
    missing.push(`files missing: ${fileCheck.missing.join(", ")}`);
  }

  checkPolicyFiles(context, path, missing);

  return invariantResult(`${path}: CLI package metadata`, missing.length === 0, missing.join("; "));
}

function collectDependencyState(context) {
  const badLinkFile = [];
  const workspaceNames = new Set();
  const badInternalProtocol = [];

  for (const parsed of context.parsedPackages.values()) {
    if (parsed.name) {
      workspaceNames.add(parsed.name);
    }
  }

  for (const [file, parsed] of context.parsedPackages) {
    const dependencySections = [
      parsed.dependencies,
      parsed.devDependencies,
      parsed.peerDependencies,
      parsed.optionalDependencies,
    ];

    for (const dependencies of dependencySections) {
      for (const [name, value] of Object.entries(dependencies || {})) {
        if (typeof value !== "string") continue;
        if (value.startsWith("link:") || value.startsWith("file:")) {
          badLinkFile.push(`${file}: ${name}:${value}`);
        }
      }
    }
  }

  for (const [file, parsed] of context.parsedPackages) {
    const localDependencySections = [
      parsed.dependencies,
      parsed.devDependencies,
      parsed.optionalDependencies,
    ];

    for (const dependencies of localDependencySections) {
      for (const [name, value] of Object.entries(dependencies || {})) {
        if (typeof value !== "string") continue;
        if (!workspaceNames.has(name)) continue;
        if (!value.startsWith("workspace:")) {
          badInternalProtocol.push(`${file} -> ${name}:${value}`);
        }
      }
    }
  }

  return { badLinkFile, badInternalProtocol };
}

export function checkNoLinkOrFileLocalDeps(context) {
  const { badLinkFile } = collectDependencyState(context);
  return invariantResult(
    "no link: or file: local deps",
    badLinkFile.length === 0,
    badLinkFile.slice(0, 10).join(", "),
  );
}

export function checkInternalLocalDepsUseWorkspaceProtocol(context) {
  const { badInternalProtocol } = collectDependencyState(context);
  return invariantResult(
    "internal local deps use workspace protocol",
    badInternalProtocol.length === 0,
    badInternalProtocol.slice(0, 10).join(", "),
  );
}

export function checkLicenseFilesMatch(context) {
  const mismatches = [];

  for (const [file, parsed] of context.parsedPackages) {
    const licenseField = parsed.license;
    if (!licenseField) continue;

    const licensePath = file.replace(/package\.json$/, "LICENSE");
    if (!existsInRoot(context, licensePath)) {
      mismatches.push(`${file}: declared license "${licenseField}" but ${licensePath} is missing`);
      continue;
    }

    const marker = LICENSE_MARKERS[licenseField];
    if (!marker) {
      mismatches.push(
        `${file}: unknown license "${licenseField}" (expected one of ${Object.keys(LICENSE_MARKERS).join(", ")})`,
      );
      continue;
    }

    if (!readTextInRoot(context, licensePath).includes(marker)) {
      mismatches.push(`${file}: license "${licenseField}" does not match ${licensePath}`);
    }
  }

  return invariantResult(
    "package license fields match LICENSE files",
    mismatches.length === 0,
    mismatches.slice(0, 10).join("; "),
  );
}

export function checkWorkspacePackageList(context) {
  const workspacePackageFiles = context.packageFiles
    .filter((path) => /^(apps|cli|libs)\/[^/]+\/package\.json$/.test(path))
    .sort();

  return invariantResult(
    "workspace package list under target roots",
    JSON.stringify(workspacePackageFiles) ===
      JSON.stringify(EXPECTED_WORKSPACE_PACKAGE_FILES.slice().sort()),
    `found ${workspacePackageFiles.length}: ${workspacePackageFiles.join(", ")}`,
  );
}

export function checkNestedPackageFilesAreDocumented(context) {
  const workspacePackageFiles = context.packageFiles
    .filter((path) => /^(apps|cli|libs)\/[^/]+\/package\.json$/.test(path))
    .sort();
  const nestedPackageFiles = context.packageFiles
    .filter((path) => /^(apps|cli|libs)\/.+\/package\.json$/.test(path))
    .filter((path) => !workspacePackageFiles.includes(path))
    .sort();
  const unexpectedNestedPackageFiles = nestedPackageFiles.filter(
    (path) => !ALLOWED_NESTED_PACKAGE_FILES.includes(path),
  );

  return invariantResult(
    "nested package.json files are documented exceptions",
    unexpectedNestedPackageFiles.length === 0,
    nestedPackageFiles.length ? nestedPackageFiles.join(", ") : "none",
  );
}

export function checkCoreUsesExplicitSubpathExports(context) {
  const pkg = readJsonInRoot(context, "libs/core/package.json");
  const exportNames = Object.keys(pkg.exports ?? {});
  const invalidExports = exportNames.filter(
    (name) => name === "." || name === "./" || !name.startsWith("./") || name.includes("*"),
  );
  const problems = [];

  if (exportNames.length === 0) problems.push("no exports declared");
  if (invalidExports.length > 0) problems.push(`invalid exports: ${invalidExports.join(", ")}`);

  return invariantResult(
    "@diffgazer/core uses explicit subpath exports without a root entry",
    problems.length === 0,
    problems.join("; "),
  );
}

export function checkUiPackageMetadata(context) {
  return checkPackageMetadata(context, {
    path: "libs/ui/package.json",
    expectedName: "@diffgazer/ui",
    expectedHomePageSuffix: "libs/ui",
    expectedRepoDir: "libs/ui",
    expectedExports: [
      "./components/*",
      "./hooks/*",
      "./lib/*",
      "./theme-base.css",
      "./theme.css",
      "./sources.css",
      "./styles.css",
    ],
    expectedFiles: ["dist", "LICENSE", "README.md", "SECURITY.md", "SUPPORT.md"],
    expectedSideEffects: ["**/*.css"],
  });
}

export function checkKeysPackageMetadata(context) {
  return checkPackageMetadata(context, {
    path: "libs/keys/package.json",
    expectedName: "@diffgazer/keys",
    expectedHomePageSuffix: "libs/keys",
    expectedRepoDir: "libs/keys",
    expectedExports: ["."],
    expectedFiles: ["dist", "README.md", "LICENSE", "SECURITY.md", "SUPPORT.md"],
    expectedSideEffects: false,
  });
}

export function checkDiffgazerCliPackageMetadata(context) {
  return checkCliPackageMetadata(context, {
    path: "cli/diffgazer/package.json",
    expectedName: "diffgazer",
    expectedBinName: "diffgazer",
    expectedRepoDir: "cli/diffgazer",
    expectedFiles: [
      "dist",
      "bin/diffgazer.js",
      "README.md",
      "LICENSE",
      "SECURITY.md",
      "SUPPORT.md",
    ],
  });
}

export function checkAddCliPackageMetadata(context) {
  return checkCliPackageMetadata(context, {
    path: "cli/add/package.json",
    expectedName: "@diffgazer/add",
    expectedBinName: "dgadd",
    expectedRepoDir: "cli/add",
    expectedFiles: ["dist", "README.md", "LICENSE", "SECURITY.md", "SUPPORT.md"],
  });
}

function getPublishablePackages(context) {
  return [...context.parsedPackages.entries()].filter(
    ([, parsed]) => !parsed.private && parsed.publishConfig,
  );
}

export function checkNoPublishableInternalDocsManifest(context) {
  const manifestInFiles = getPublishablePackages(context)
    .filter(([, parsed]) => (parsed.files ?? []).includes("internal-docs-manifest.json"))
    .map(([file]) => file);

  return invariantResult(
    "no publishable package ships internal-docs-manifest.json",
    manifestInFiles.length === 0,
    manifestInFiles.join(", "),
  );
}

export function checkPublishMetadataPolicy(context) {
  const violations = [];

  for (const path of PUBLISHABLE_PACKAGE_FILES) {
    const pkg = readJsonInRoot(context, path);
    const problems = [];

    if (pkg.private) {
      problems.push("private: true");
    }
    if (pkg.publishConfig?.access !== "public") {
      problems.push(`publishConfig.access: ${pkg.publishConfig?.access}`);
    }
    if (pkg.publishConfig?.provenance !== true) {
      problems.push(`publishConfig.provenance: ${pkg.publishConfig?.provenance}`);
    }
    if (!pkg.engines?.node) {
      problems.push("engines.node missing");
    }
    if (!pkg.license) {
      problems.push("license missing");
    }
    if (!pkg.author) {
      problems.push("author missing");
    }

    if (problems.length) {
      violations.push(`${path}: ${problems.join(", ")}`);
    }
  }

  return invariantResult(
    "publishable packages set publish metadata policy",
    violations.length === 0,
    violations.join("; "),
  );
}

export function checkPublishablePackagesMatchFixedList(context) {
  const derived = getPublishablePackages(context)
    .map(([file]) => file)
    .sort();
  const expected = PUBLISHABLE_PACKAGE_FILES.slice().sort();
  const problems = [];

  const missingFromFixedList = derived.filter((file) => !expected.includes(file));
  if (missingFromFixedList.length) {
    problems.push(`missing from fixed list: ${missingFromFixedList.join(", ")}`);
  }

  const staleFixedListEntries = expected.filter((file) => !derived.includes(file));
  if (staleFixedListEntries.length) {
    problems.push(`fixed list not publishable: ${staleFixedListEntries.join(", ")}`);
  }

  return invariantResult(
    "publishable package set matches fixed policy list",
    problems.length === 0,
    problems.join("; "),
  );
}

export function checkPublishablePackagesShareEngineFloor(context) {
  const engineFloors = getPublishablePackages(context).map(([file, parsed]) => ({
    file,
    node: parsed.engines?.node,
  }));
  const uniqueEngineFloors = [...new Set(engineFloors.map((entry) => entry.node))];

  return invariantResult(
    "publishable packages share one engines.node",
    uniqueEngineFloors.length === 1 && uniqueEngineFloors[0] != null,
    engineFloors.map((entry) => `${entry.file}: ${entry.node ?? "missing"}`).join(", "),
  );
}
