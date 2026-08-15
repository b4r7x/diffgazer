// dependency-cruiser config: encodes the AGENTS.md layer boundaries plus no-circular/no-orphans across
// the workspace. Run from repo root via `pnpm run depcruise` against `apps cli libs`.
//
// Cross-feature matching needs two strategies, because a single root crawl cannot resolve the same `@`
// alias per app: `@/`-alias imports match by import SPECIFIER, relative imports match by RESOLVED path.
// cli/server and cli/diffgazer only reach siblings relatively, so they carry the resolved-path rule alone;
// apps/web and apps/docs write both forms, so they carry one rule of each. Workspace `@diffgazer/*` deps
// resolve into build output, so the output is not followed while its import edge remains visible to the
// cross-package rules. Circular detection runs on runtime deps only (tsPreCompilationDeps:false); type-only
// cycles are erased at compile time.

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment:
        "Runtime circular dependencies break tree-shaking and module init order. (Computed on runtime deps only; type-only cycles are erased at compile time.)",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-orphans",
      severity: "error",
      comment:
        "Orphan modules (imported by nothing) are usually dead code; entrypoints and generated files are exempt.",
      from: {
        orphan: true,
        // Re-derive this list by emptying it and running `pnpm run depcruise`: every entry below
        // exempts a module that run reports, or a role (entrypoint, route, fixture, script, test)
        // whose consumer is outside the crawl. An entry matching nothing suppresses nothing.
        pathNot: [
          "\\.d\\.ts$",
          "(^|/)\\.source/",
          // Type-only modules are consumed via `import type`, which the runtime
          // crawl (tsPreCompilationDeps:false) does not follow.
          "(^|/)types\\.ts$",
          "(^|/)types/",
          "^cli/server/src/shared/lib/http/error-codes\\.ts$",
          "^libs/core/src/schemas/presentation/(category-stats|timeline)\\.ts$",
          // Public package subpath exports and documentation data are consumed through
          // package.json exports or artifact/doc loaders, not the runtime application graph
          // crawled here. The catalog bundle-evidence helper is package-exported verification
          // support: its server bundle test and models-dev smoke import the explicit
          // `@diffgazer/core/testing/catalog-bundle-evidence` subpath.
          "^libs/core/src/testing/catalog-bundle-evidence\\.ts$",
          "^libs/keys/docs/hook-docs/[^/]+\\.ts$",
          // Package/app entrypoints and tooling configs are intentionally orphaned.
          "(^|/)src/index\\.tsx?$",
          "(^|/)src/main\\.tsx?$",
          "(^|/)src/serve\\.ts$",
          "(^|/)src/client\\.tsx?$",
          "(^|/)src/server\\.ts$",
          // Browser fixtures are Vite entrypoints referenced from HTML rather
          // than imported by another TypeScript module.
          "(^|/)testing/fixtures/",
          // Tooling scripts are invoked by package scripts rather than imports.
          "(^|/)scripts/[^/]+\\.[cm]?[jt]s$",
          // Test helpers reached only through an app `@/` alias or a Playwright fixture page.
          "^libs/ui/testing/",
          "^apps/web/src/testing/reticle\\.tsx?$",
          "^apps/docs/src/testing/router-mock\\.tsx?$",
          "(^|/)test-setup\\.ts$",
          "^libs/core/testing/setup\\.ts$",
          "\\.(test|spec|e2e|stories)\\.[jt]sx?$",
          "\\.config\\.[jt]s$",
          "(^|/)src/routes/",
          // Package registry source is consumed by artifact builders and copy
          // consumers, not the runtime app import graph.
          "^libs/(ui|keys)/registry/",
          // App-local @/* aliases are validated by specifier-based boundary rules.
          // A single root crawl cannot resolve the same @ alias per app, so keep
          // no-orphans precise for alias-reached web modules instead of disabling it.
          "^apps/web/src/lib/main-content\\.ts$",
          "^apps/web/src/theme-bootstrap\\.tsx?$",
          "^apps/web/src/lib/selected-option-row\\.tsx?$",
          "^apps/web/src/hooks/use-focus-within\\.tsx?$",
          "^apps/web/src/lib/review-error-copy\\.tsx?$",
          "^apps/docs/src/(components/(shared/(dot-grid|error-boundary|focus-ring|sidebar-item)|mdx-preload-marker)|hooks/(docs-tree-context|use-is-scrollable)|lib/(example-frames|generated-doc-data))\\.tsx?$",
          "^libs/core/src/schemas/events/statuses\\.tsx?$",
        ],
      },
      to: {},
    },
    {
      name: "core-not-app-or-cli",
      severity: "error",
      comment: "libs/core is private shared business logic and must not depend on apps/* or cli/*.",
      from: { path: "^libs/core/" },
      to: {
        // Matches both relative imports (resolved into apps/cli source) and the
        // workspace package specifiers for app/cli packages.
        path: "^(apps/|cli/|@diffgazer/(web|landing|docs|add|server)|diffgazer($|/))",
      },
    },
    {
      name: "app-source-not-cli",
      severity: "error",
      comment:
        "App source must not reach into cli/* source by relative escape: the edge is invisible to the workspace manifests and reverses the cli->app direction the CLI packages declare. Assert CLI behaviour from the CLI workspace, which declares the dependencies. Only the app testing/ tier may launch a CLI binary artifact.",
      from: { path: "^apps/[^/]+/src/" },
      to: { path: ["^cli/", "^@diffgazer/(add|server)", "^diffgazer($|/)"] },
    },
    {
      name: "no-cross-feature",
      severity: "error",
      comment:
        "Features are vertical slices; a feature must not import a sibling feature. Promote shared code to the app-shared tier. (apps/web, apps/docs: matched by @/ specifier.)",
      from: { path: "/features/([^/]+)/" },
      to: {
        path: "^@/features/",
        // Same-feature imports are allowed ($1 is the source feature name).
        pathNot: ["^@/features/$1/"],
      },
    },
    {
      name: "no-cross-feature-apps",
      severity: "error",
      comment:
        "apps/web and apps/docs features are vertical slices; a feature must not import a sibling feature. Matched by resolved path, which covers the relative ../ form that no-cross-feature's @/ specifier cannot see.",
      from: { path: "^apps/(web|docs)/src/features/([^/]+)/" },
      to: {
        path: "^apps/$1/src/features/",
        // Same-feature imports are allowed ($2 is the source feature name).
        pathNot: ["^apps/$1/src/features/$2/"],
      },
    },
    {
      name: "no-cross-feature-server",
      severity: "error",
      comment:
        "cli/server features are vertical slices; a feature must not import a sibling feature. Matched by resolved path because cli/server reaches siblings through relative ../ specifiers. Integration tests (config/settings asserting the review session-cancellation cascade) are exempt, like no-orphans treats tests.",
      from: {
        path: "^cli/server/src/features/([^/]+)/",
        pathNot: "\\.(test|spec)\\.[jt]sx?$",
      },
      to: {
        path: "^cli/server/src/features/",
        // Same-feature imports are allowed ($1 is the source feature name).
        pathNot: ["^cli/server/src/features/$1/"],
      },
    },
    {
      name: "no-cli-compatibility-barrel",
      severity: "error",
      comment:
        "compat.ts and probe.ts are the cli-compatibility facade for consumers outside the directory. A sibling inside it must import its owning module (record, child-environment, process-supervisor, probe-runner, ...) directly, or the split that produced those modules leaves the whole subtree connected through one hub. Tests are exempt, like no-orphans treats tests.",
      from: {
        path: "^cli/server/src/shared/lib/ai/providers/cli-compatibility/",
        pathNot: "\\.(test|spec)\\.[jt]sx?$",
      },
      to: {
        path: "^cli/server/src/shared/lib/ai/providers/cli-compatibility/(compat|probe)\\.ts$",
      },
    },
    {
      name: "no-cross-feature-cli",
      severity: "error",
      comment:
        "cli/diffgazer features are vertical slices; a feature must not import a sibling feature. Matched by resolved path because cli/diffgazer reaches siblings through relative ../ specifiers. Tests are exempt, like no-orphans treats tests.",
      from: {
        path: "^cli/diffgazer/src/features/([^/]+)/",
        pathNot: "\\.(test|spec)\\.[jt]sx?$",
      },
      to: {
        path: "^cli/diffgazer/src/features/",
        // Same-feature imports are allowed ($1 is the source feature name).
        pathNot: ["^cli/diffgazer/src/features/$1/"],
      },
    },
    {
      name: "components-not-features",
      severity: "error",
      comment:
        "The app-shared components/ tier must not import from features/* (shared->feature is the wrong direction). The @/ specifier and the resolved app paths are both listed so a relative ../features/ import is caught too.",
      from: { path: "/src/components/" },
      to: {
        path: ["^@/features/", "^apps/(web|docs)/src/features/", "^cli/diffgazer/src/features/"],
      },
    },
    {
      name: "landing-only-ui",
      severity: "error",
      comment:
        "apps/landing is marketing-only and may depend on @diffgazer/ui exclusively, never on other workspace packages. Workspace package imports resolve through pnpm links into libs/* or cli/*, so both resolved paths and raw specifiers are covered.",
      from: { path: "^apps/landing/" },
      to: {
        path: ["^@diffgazer/(?!ui(/|$))", "^libs/(?!ui(?:/|$))", "^cli/"],
      },
    },
  ],
  options: {
    doNotFollow: {
      path: ["node_modules", "(^|/)dist/"],
    },
    exclude: {
      path: [
        "node_modules",
        "(^|/)\\.output/",
        "(^|/)\\.turbo/",
        "(^|/)\\.vinxi/",
        "(^|/)playwright-report/",
        "(^|/)test-results/",
        "(^|/)coverage/",
        "(^|/)generated/",
        "libs/ui/docs/generated/",
        "libs/keys/docs/generated/",
        "libs/keys/artifacts/artifacts/",
        "cli/add/src/generated/",
        "apps/docs/src/generated/",
        "apps/docs/src/routeTree\\.gen\\.ts$",
        "apps/docs/registry/",
        "libs/core/src/catalog/catalog-snapshot\\.ts$",
        "(^|/)public/r/",
      ],
    },
    tsPreCompilationDeps: false,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      extensions: [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"],
    },
  },
};
