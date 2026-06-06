// dependency-cruiser config for the Diffgazer monorepo.
//
// The repo is Biome-only with no ESLint boundary plugin, so dependency-cruiser
// is the standalone tool that encodes the AGENTS.md layer boundaries plus
// no-circular and no-orphans across the whole workspace. Run from the repo root
// via `pnpm run depcruise` against `apps cli libs`.
//
// Rules match import SPECIFIERS, not resolved filesystem paths: the `@/features`
// alias differs per app, and workspace `@diffgazer/*` deps resolve into excluded
// build output, so specifier matching is the reliable cross-package mechanism.
// Circular detection runs on runtime deps only (tsPreCompilationDeps:false).
//
// Two pre-existing apps/docs couplings are grandfathered below with explicit
// `pathNot` exceptions so the rule stays active for every NEW violation while
// the gate still passes on the realized tree. Remove the exceptions once docs
// extracts the shared search context and the theme MDX bridge.

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "Runtime circular dependencies break tree-shaking and module init order. (Computed on runtime deps only; type-only cycles are erased at compile time.)",
      from: {
        // Grandfathered: the recursive submenu pattern (Menu <-> MenuSub) is a
        // pre-existing runtime cycle that works via deferred render-time imports.
        pathNot: "libs/ui/registry/ui/menu/menu(-sub)?\\.tsx$",
      },
      to: { circular: true },
    },
    {
      name: "no-orphans",
      severity: "warn",
      comment: "Orphan modules (imported by nothing) are usually dead code; entrypoints and generated files are exempt.",
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
          // Public package subpath exports and documentation data are consumed
          // through package.json exports or artifact/doc loaders, not the
          // runtime application graph crawled here.
          "^libs/core/src/testing/dom-polyfills\\.ts$",
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
          "^scripts/monorepo/artifacts/(fixture|sync|validation)\\.mjs$",
          "(^|/)scripts/[^/]+\\.[cm]?[jt]s$",
          // Test helpers are imported only from test modules, which are not roots
          // in the runtime dependency crawl.
          "(^|/)(src|registry)/testing/(assertions|navigation-behavior)\\.tsx?$",
          "^libs/ui/testing/",
          "^apps/web/src/testing/(escape-regexp|factories|render)\\.tsx?$",
          "(^|/)test-setup\\.ts$",
          "\\.(test|spec|e2e|stories)\\.[jt]sx?$",
          "\\.config\\.[jt]s$",
          "(^|/)src/routes/",
          // Package registry source is consumed by artifact builders and copy
          // consumers, not the runtime app import graph.
          "^libs/(ui|keys)/(registry|public/r)/",
          // Public package subpath exports are reached through @diffgazer/core/*
          // specifiers; this root crawl resolves those to dist, which is excluded.
          "^libs/core/src/(breakpoints|get-figlet)\\.ts$",
          // App-local @/* aliases are validated by specifier-based boundary rules.
          // A single root crawl cannot resolve the same @ alias per app, so keep
          // no-orphans precise for alias-reached web modules instead of disabling it.
          "^apps/web/src/(features/(providers/components/list|history/hooks/use-keyboard|help/components/page)|components/ui/card-layout)\\.tsx?$",
          "^apps/docs/src/(components/(content-spinner|not-found-state|preview-inset-pane|layout/footer)|features/theme/components/(diffgazer-preview|variable-diagram)|lib/(consumption-metadata|cross-deps-data|example-frames|resolve-examples|styles|use-copy-feedback|use-demos))\\.tsx?$",
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
      comment: "Features are vertical slices; a feature must not import a sibling feature. Promote shared code to the app-shared tier.",
      from: { path: "/features/([^/]+)/" },
      to: {
        path: "^@/features/",
        pathNot: [
          // Same-feature imports are allowed ($1 is the source feature name).
          "^@/features/$1/",
          // Grandfathered: apps/docs home feature consumes the search context.
          "^@/features/search/search-context$",
        ],
      },
    },
    {
      name: "components-not-features",
      severity: "error",
      comment: "The app-shared components/ tier must not import from features/* (shared->feature is the wrong direction).",
      from: { path: "/src/components/" },
      to: {
        path: "^@/features/",
        // Grandfathered: docs MDX bridge surfaces theme feature components.
        pathNot: ["^@/features/theme/"],
      },
    },
    {
      name: "landing-only-ui",
      severity: "error",
      comment: "apps/landing is marketing-only and may depend on @diffgazer/ui exclusively, never on other workspace packages.",
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
