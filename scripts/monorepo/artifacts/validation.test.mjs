import assert from "node:assert/strict";
import { readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, it } from "node:test";
import { createTempDirs, writeFile } from "./fixture.mjs";
import { validateArtifactPackSurface } from "./pack-surface.mjs";
import {
  collectBundleRelativeJsImportErrors,
  collectTreeParityErrors,
  computeBundleIntegrity,
  computeStrictInputsFingerprint,
  validateIntegrityBundle,
  validateLibraryArtifacts,
} from "./validation.mjs";

const { makeTempDir, cleanupTempDirs } = createTempDirs("artifact-validation-test-");

afterEach(() => {
  cleanupTempDirs();
});

function writeLibraryFixture(root) {
  writeFile(root, "docs/content/index.mdx", "# Intro\n");
  writeFile(root, "docs/generated/component-list.json", "[]\n");
  writeFile(root, "registry/registry.json", '{"items":[]}\n');
  writeFile(root, "public/r/registry.json", '{"items":[]}\n');
  writeFile(root, "package.json", '{"name":"@test/lib","version":"1.0.0"}\n');

  const { fingerprint } = computeStrictInputsFingerprint(root, [
    "docs/content",
    "docs/generated",
    "registry",
    "public/r",
    "package.json",
  ]);

  writeFile(
    root,
    "dist/artifacts/artifact-manifest.json",
    JSON.stringify({
      schemaVersion: 1,
      library: "test",
      package: "@test/lib",
      version: "1.0.0",
      artifactRoot: "dist/artifacts",
      inputs: ["docs/content", "docs/generated", "registry", "public/r", "package.json"],
      docs: {
        contentDir: "docs",
        metaFile: "docs/meta.json",
        generatedDir: "generated",
      },
      registry: {
        namespace: "@test/lib",
        basePath: "/r/test",
        publicDir: "registry",
        index: "registry/registry.json",
      },
      generated: {
        componentList: "generated/component-list.json",
      },
      integrity: {
        algorithm: "sha256",
        fingerprintFile: "fingerprint.sha256",
      },
    }),
  );
  writeFile(root, "dist/artifacts/fingerprint.sha256", `${fingerprint}\n`);
  writeFile(root, "dist/artifacts/docs/index.mdx", "# Intro\n");
  writeFile(root, "dist/artifacts/registry/registry.json", '{"items":[]}\n');
  writeFile(root, "dist/artifacts/generated/component-list.json", "[]\n");
}

describe("artifact validation", () => {
  it("accepts fresh library artifacts", () => {
    const root = makeTempDir();
    writeLibraryFixture(root);

    assert.deepEqual(validateLibraryArtifacts({ rootDir: root, label: "fixture" }), []);
  });

  it("fails closed when fingerprint inputs are missing", () => {
    const root = makeTempDir();
    writeLibraryFixture(root);
    rmSync(resolve(root, "docs/generated"), { recursive: true, force: true });

    assert.ok(
      validateLibraryArtifacts({ rootDir: root, label: "fixture" }).includes(
        "fixture: missing fingerprint input docs/generated",
      ),
    );
  });

  it("fails when public registry artifacts are stale or tampered", () => {
    const root = makeTempDir();
    writeLibraryFixture(root);
    writeFile(root, "dist/artifacts/registry/registry.json", '{"items":[{"name":"stale"}]}\n');

    assert.ok(
      validateLibraryArtifacts({ rootDir: root, label: "fixture" }).includes(
        "fixture public/r: artifact differs from source for registry.json",
      ),
    );
  });

  it("fails when manifest-declared docs artifacts are stale or tampered", () => {
    const root = makeTempDir();
    writeLibraryFixture(root);
    writeFile(root, "dist/artifacts/docs/index.mdx", "# Stale\n");

    assert.ok(
      validateLibraryArtifacts({ rootDir: root, label: "fixture" }).includes(
        "fixture docs content: artifact differs from source for index.mdx",
      ),
    );
  });

  it("rejects artifact manifest paths that escape the artifact root", () => {
    const root = makeTempDir();
    writeLibraryFixture(root);
    const manifestPath = resolve(root, "dist/artifacts/artifact-manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    manifest.docs.contentDir = "../outside";
    writeFile(root, "dist/artifacts/artifact-manifest.json", JSON.stringify(manifest));

    assert.ok(
      validateLibraryArtifacts({ rootDir: root, label: "fixture" })
        .join("\n")
        .includes(
          "fixture: docs.contentDir: Path must be relative and must not contain '..' segments",
        ),
    );
  });

  it("honors manifest-declared artifact roots instead of defaulting to dist artifacts", () => {
    const root = makeTempDir();
    writeLibraryFixture(root);
    const manifestPath = resolve(root, "dist/artifacts/artifact-manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    manifest.artifactRoot = "dist/other-artifacts";
    writeFile(root, "dist/artifacts/artifact-manifest.json", JSON.stringify(manifest));

    const errors = validateLibraryArtifacts({
      rootDir: root,
      label: "fixture",
    });

    assert.ok(
      errors.includes(
        "fixture: artifact manifest root dist/other-artifacts does not match validated artifact root dist/artifacts",
      ),
    );
    assert.ok(
      errors
        .join("\n")
        .includes(
          `fixture: missing artifact fingerprint at ${resolve(root, "dist/other-artifacts/fingerprint.sha256")}`,
        ),
    );
  });

  it("validates copied artifact mirrors without recomputing source fingerprints", () => {
    const root = makeTempDir();
    writeFile(root, "source/artifact-manifest.json", '{"ok":true}\n');
    writeFile(root, "mirror/artifact-manifest.json", '{"ok":false}\n');

    assert.deepEqual(
      collectTreeParityErrors(resolve(root, "source"), resolve(root, "mirror"), "mirror"),
      ["mirror: artifact differs from source for artifact-manifest.json"],
    );
  });

  it("fails tampered integrity bundles", () => {
    const root = makeTempDir();
    const bundle = {
      items: [
        {
          name: "use-key",
          files: [{ path: "hooks/use-key.ts", content: "export {}\n" }],
        },
      ],
    };
    const integrity = computeBundleIntegrity(bundle, ["items"]);
    const bundlePath = resolve(root, "bundle.json");
    writeFile(
      root,
      "bundle.json",
      JSON.stringify({
        ...bundle,
        items: [
          {
            name: "use-key",
            files: [{ path: "hooks/use-key.ts", content: "tampered\n" }],
          },
        ],
        integrity,
      }),
    );

    assert.match(
      validateIntegrityBundle(bundlePath, ["items"], "keys bundle")[0],
      /keys bundle: bundle integrity mismatch/,
    );
  });

  it("requires every declared integrity bundle key", () => {
    const root = makeTempDir();
    const bundle = {
      items: [{ name: "button" }],
      theme: {},
    };
    const bundlePath = resolve(root, "bundle.json");
    writeFile(
      root,
      "bundle.json",
      JSON.stringify({
        ...bundle,
        integrity: computeBundleIntegrity(bundle, ["items", "theme", "styles"]),
      }),
    );

    assert.ok(
      validateIntegrityBundle(bundlePath, ["items", "theme", "styles"], "registry bundle").includes(
        "registry bundle: bundle styles is missing",
      ),
    );
  });

  it("fails package artifact surface validation when packed files include leaked artifact payloads", () => {
    const root = makeTempDir();

    assert.ok(
      validateArtifactPackSurface(
        root,
        {
          id: "test",
          packageName: "@test/lib",
          workspaceDir: ".",
        },
        ["dist/artifacts/artifact-manifest.json", "dist/artifacts/fingerprint.sha256"],
      ).includes(
        "@test/lib npm pack must not ship dist/artifacts: dist/artifacts/artifact-manifest.json, dist/artifacts/fingerprint.sha256",
      ),
    );
  });

  it("passes package artifact surface validation when packed files exclude artifact payloads", () => {
    const root = makeTempDir();

    assert.deepEqual(
      validateArtifactPackSurface(
        root,
        {
          id: "test",
          packageName: "@test/lib",
          workspaceDir: ".",
        },
        ["package.json", "README.md", "dist/index.js"],
      ),
      [],
    );
  });
});

describe("collectBundleRelativeJsImportErrors", () => {
  it("flags relative .js import specifiers in bundled file content", () => {
    const items = [
      {
        files: [
          {
            target: "src/hooks/use-focus-restore.ts",
            content: 'import { restoreFocus } from "./utils/focus-restore.js";\n',
          },
        ],
      },
    ];

    assert.deepEqual(collectBundleRelativeJsImportErrors(items, "bundle"), [
      'bundle: src/hooks/use-focus-restore.ts has relative .js import specifiers: from "./utils/focus-restore.js"',
    ]);
  });

  it("flags static, dynamic, and require relative .js specifiers", () => {
    const items = [
      {
        files: [
          {
            path: "registry/ui/x/index.ts",
            content: [
              'import "./setup.js";',
              'const lazy = import("../lazy.js");',
              'const req = require("./dep.js");',
            ].join("\n"),
          },
        ],
      },
    ];

    assert.deepEqual(collectBundleRelativeJsImportErrors(items, "bundle"), [
      'bundle: registry/ui/x/index.ts has relative .js import specifiers: import "./setup.js", import("../lazy.js", require("./dep.js"',
    ]);
  });

  it("passes when content carries no relative .js specifiers", () => {
    const items = [
      {
        files: [
          {
            target: "src/hooks/use-focus-restore.ts",
            content: [
              'import { restoreFocus } from "./utils/focus-restore";',
              'import { Big } from "figlet/importable-fonts/Big.js";',
            ].join("\n"),
          },
        ],
      },
    ];

    assert.deepEqual(collectBundleRelativeJsImportErrors(items, "bundle"), []);
  });
});
