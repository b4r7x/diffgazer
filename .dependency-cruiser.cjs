// dependency-cruiser config: encodes the AGENTS.md layer boundaries plus no-circular/no-orphans across
// the workspace. Run from repo root via `pnpm run depcruise` against `apps cli libs`.
//
// Cross-feature matching uses two strategies: `@/`-alias surfaces (apps/web, apps/docs) match by import
// SPECIFIER because a single root crawl cannot resolve the same `@` alias per app; relative-import
// surfaces (cli/server, cli/diffgazer) match by RESOLVED path. Workspace `@diffgazer/*` deps resolve into
// excluded build output, so the cross-package rules match specifiers too. Circular detection runs on
// runtime deps only (tsPreCompilationDeps:false); type-only cycles are erased at compile time.

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
      severity: "warn",
      comment:
        "Orphan modules (imported by nothing) are usually dead code; entrypoints and generated files are exempt.",
      from: {
        orphan: true,
        pathNot: [
          "\\.d\\.ts$",
          "(^|/)dist/",
          "(^|/)public/r/",
          "(^|/)generated/",
          "(^|/)\\.source/",
          "catalog-snapshot\\.ts$",
          // Type-only modules are consumed via `import type`, which the runtime
          // crawl (tsPreCompilationDeps:false) does not follow.
          "(^|/)types\\.ts$",
          "(^|/)types/",
          "^cli/server/src/shared/lib/http/error-codes\\.ts$",
          "^libs/core/src/schemas/presentation/(timeline|category-stats)\\.ts$",
          // Public package subpath exports and documentation data are consumed
          // through package.json exports or artifact/doc loaders, not the
          // runtime application graph crawled here.
          "^libs/core/src/testing/dom-polyfills\\.ts$",
          "^libs/core/src/schemas/(git|context)\\.ts$",
          "^libs/keys/docs/hook-docs/[^/]+\\.ts$",
          // Package/app entrypoints and tooling configs are intentionally orphaned.
          "(^|/)src/index\\.tsx?$",
          "(^|/)src/main\\.tsx?$",
          "(^|/)src/serve\\.ts$",
          "(^|/)src/client\\.tsx?$",
          "(^|/)src/server\\.ts$",
          "(^|/)bin/",
          // Tooling scripts are invoked by package scripts rather than imports.
          "^scripts/monorepo/[^/]+\\.mjs$",
          "(^|/)scripts/[^/]+\\.[cm]?[jt]s$",
          // Test helpers are imported only from test modules, which are not roots
          // in the runtime dependency crawl.
          "(^|/)(src|registry)/testing/(assertions|navigation-behavior)\\.tsx?$",
          "^libs/ui/testing/",
          "^apps/web/src/testing/(escape-regexp|factories|render)\\.tsx?$",
          "^apps/docs/src/testing/(match-media|router-mock)\\.tsx?$",
          "(^|/)test-setup\\.ts$",
          "\\.(test|spec|e2e|stories)\\.[jt]sx?$",
          "\\.config\\.[jt]s$",
          "(^|/)src/routes/",
          // Package registry source is consumed by artifact builders and copy
          // consumers, not the runtime app import graph.
          "^libs/(ui|keys)/(registry|public/r)/",
          // App-local @/* aliases are validated by specifier-based boundary rules.
          // A single root crawl cannot resolve the same @ alias per app, so keep
          // no-orphans precise for alias-reached web modules instead of disabling it.
          "^apps/web/src/hooks/(use-theme|use-config)\\.tsx$",
          "^apps/web/src/lib/main-content\\.ts$",
          "^apps/web/src/(features/(providers/components/list|history/hooks/use-keyboard|help/components/page)|components/ui/card-layout)\\.tsx?$",
          "^apps/docs/src/(components/(content-spinner|not-found-state|preview-inset-pane|shared/(chrome-label|dot-grid|focus-ring)|layout/(tui-fault-panel|tui-bracket-link)|docs-mdx/(markdown-renderers|blocks/steps))|features/theme/components/(diffgazer-preview|variable-diagram)|hooks/(theme-context|use-demos)|lib/(consumption-metadata|cross-deps-data|docs-chrome|example-frames|generated-doc-data|resolve-examples))\\.tsx?$",
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
        "The app-shared components/ tier must not import from features/* (shared->feature is the wrong direction).",
      from: { path: "/src/components/" },
      to: {
        path: "^@/features/",
      },
    },
    {
      name: "landing-only-ui",
      severity: "error",
      comment:
        "apps/landing is marketing-only and may depend on @diffgazer/ui exclusively, never on other workspace packages.",
      from: { path: "^apps/landing/" },
      to: {
        path: "^@diffgazer/(?!ui(/|$))",
      },
    },
  ],
  options: {
    doNotFollow: {
      path: ["node_modules"],
    },
    exclude: {
      path: [
        "node_modules",
        "(^|/)dist/",
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
