# @diffgazer/registry

Private workspace engine for building **shadcn-compatible registries**, publishing artifacts, and syncing docs from multiple libraries into the diffgazer docs host.

## Install

```bash
pnpm add @diffgazer/registry --workspace
```

## Features

### Producer side (library build scripts)

- **`buildRegistryArtifacts(options)`** — Build artifacts with manifest, SHA-256 fingerprint, origin rewriting, and directory copying.
- **`buildShadcnRegistryWithOrigin(options)`** — Run `shadcn build` with configurable registry origin.
- **`ensurePublicRegistryReady(options)`** — Validate public registry freshness; auto-rebuild if stale.

### Consumer side (docs host)

- **`loadArtifactsFromPackage(options)`** — Load and validate artifacts from an npm-installed package.
- **`syncDocsFromArtifacts(options)`** — Full sync orchestration: load artifacts (workspace or npm), copy docs/registry/styles, fingerprint caching, origin assertion.

### Shared utilities

- **`computeInputsFingerprint(rootDir, inputs)`** — Deterministic SHA-256 fingerprint of file inputs.
- **`validateManifest(data)`** — Zod-based artifact manifest validation.
- **`normalizeOrigin(raw)`** / **`rewriteOriginsInDir(dir, options)`** — Registry origin URL manipulation.
- File system helpers: `ensureExists`, `resetDir`, `collectAllFiles`, `collectJsonFiles`, `readJson`, `writeJson`.

## Usage

### Building artifacts (library side)

```js
import { buildRegistryArtifacts } from "@diffgazer/registry";

buildRegistryArtifacts({
  rootDir: process.cwd(),
  inputs: ["docs/content", "registry", "public/r", "package.json"],
  manifest: {
    schemaVersion: 1,
    library: "my-lib",
    package: "my-lib",
    version: "1.0.0",
    artifactRoot: "dist/artifacts",
    inputs: ["docs/content", "registry", "public/r", "package.json"],
    docs: { contentDir: "docs", metaFile: "docs/meta.json", generatedDir: "generated" },
    registry: { namespace: "@mylib", basePath: "/r/my-lib", publicDir: "registry", index: "registry/registry.json" },
    integrity: { algorithm: "sha256", fingerprintFile: "fingerprint.sha256" },
  },
  copyDirs: [
    { from: "docs/content", to: "docs" },
    { from: "public/r", to: "registry" },
  ],
  rewriteDirs: ["registry"],
});
```

### Syncing artifacts (docs host side)

```js
import { syncDocsFromArtifacts, normalizeOrigin } from "@diffgazer/registry";

syncDocsFromArtifacts({
  docsRoot: "/path/to/docs/app",
  workspaceRoot: "/path/to/workspace",
  libraries: [
    { id: "my-lib", packageName: "@scope/my-lib-artifacts", workspaceDir: "my-lib" },
  ],
  primaryLibraryId: "my-lib",
  origin: normalizeOrigin(process.env.REGISTRY_ORIGIN, { defaultOrigin: "https://example.com" }),
  mode: process.env.DEV ? "workspace" : "package",
});
```

## Artifact Manifest Schema (v1)

```json
{
  "schemaVersion": 1,
  "library": "my-lib",
  "package": "my-lib",
  "version": "1.0.0",
  "artifactRoot": "dist/artifacts",
  "inputs": ["docs/content", "registry", "package.json"],
  "docs": {
    "contentDir": "docs",
    "metaFile": "docs/meta.json",
    "generatedDir": "generated",
    "assetsDir": "assets"
  },
  "registry": {
    "namespace": "@mylib",
    "basePath": "/r/my-lib",
    "publicDir": "registry",
    "index": "registry/registry.json"
  },
  "source": {
    "registryDir": "source/registry",
    "stylesDir": "source/styles"
  },
  "generated": {
    "hooksFile": "generated/hooks.json"
  },
  "integrity": {
    "algorithm": "sha256",
    "fingerprintFile": "fingerprint.sha256"
  }
}
```

## License

MIT

## Compatibility note

`@diffgazer/registry` is the legacy standalone package name. Active monorepo imports should use `@diffgazer/registry` or `@diffgazer/registry/schemas`.

## Repository metadata

- **Source:** https://github.com/b4r7x/diffgazer/tree/main/libs/registry
- **Homepage:** https://github.com/b4r7x/diffgazer/tree/main/libs/registry
