import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import {
  addonSideEffectImports,
  allRegistryIndexNames,
  assertBundledComponentsRendered,
  buildSmokeApp,
  bundledUiComponents,
  directlyInstallableUiNames,
  findUnbundledKeysEntryHooks,
  installedFilePathForFile,
  keysEntryHookNames,
  standaloneKeysHookImports,
  uiComponentNames,
  uiItems,
} from "./smoke-shadcn-install.mjs";

const root = process.cwd();
const uiRegistryDir = resolve(root, "libs/ui/public/r");
const keysRegistryDir = resolve(root, "libs/keys/public/r");

function loadItem(registryDir, name) {
  return JSON.parse(readFileSync(join(registryDir, `${name}.json`), "utf-8"));
}

test("direct install set covers every public UI index item, not a representative subset", () => {
  const allNames = allRegistryIndexNames(uiRegistryDir);

  for (const name of uiItems) {
    assert.ok(allNames.includes(name), `representative item ${name} must exist in the full index`);
  }

  // Items previously installed only in closure validation must now be in the
  // exhaustive direct-install set that runSmoke drives from the full index.
  for (const omitted of ["radio", "toggle-group", "scroll-area", "spinner", "switch", "progress"]) {
    assert.ok(allNames.includes(omitted), `exhaustive UI install must include ${omitted}`);
    assert.ok(
      !uiItems.includes(omitted),
      `${omitted} should be outside the representative subset to prove exhaustive coverage`,
    );
  }
});

test("direct-install roots include hidden leaf add-ons but not transitive-only internals", () => {
  const installable = directlyInstallableUiNames(uiRegistryDir);
  const installableSet = new Set(installable);
  const indexSet = new Set(allRegistryIndexNames(uiRegistryDir));

  // Every browsable index item stays a direct-install root.
  for (const name of indexSet) {
    assert.ok(installableSet.has(name), `index item ${name} must remain a direct-install root`);
  }

  // Hidden leaf add-ons (nothing depends on them) are directly installable.
  for (const addon of ["code-block-highlight", "logo-figlet"]) {
    assert.ok(!indexSet.has(addon), `${addon} must stay out of the browsable index`);
    assert.equal(loadItem(uiRegistryDir, addon).meta?.hidden, true);
    assert.ok(
      installableSet.has(addon),
      `hidden leaf add-on ${addon} must be a direct-install root`,
    );
  }

  // Hidden items that other items depend on are transitive-only internals and
  // must not be installed standalone; they arrive through their parents.
  for (const internal of ["portal", "dialog-shell"]) {
    assert.equal(loadItem(uiRegistryDir, internal).meta?.hidden, true);
    assert.ok(
      !installableSet.has(internal),
      `transitive-only internal ${internal} must not be a direct-install root`,
    );
  }
});

test("exhaustive keys install set includes items beyond the representative pair", () => {
  const allKeys = allRegistryIndexNames(keysRegistryDir);
  assert.ok(allKeys.includes("scroll-lock"), "scroll-lock must be exhaustively installed");
  assert.ok(allKeys.includes("focus-restore"), "focus-restore must be exhaustively installed");
});

test("smoke app bundles every registry:ui component installed via direct URLs", () => {
  const allNames = allRegistryIndexNames(uiRegistryDir);
  const componentNames = uiComponentNames(uiRegistryDir, allNames);

  // Every registry:ui item is bundled; hooks/lib/theme (which do not install
  // under src/components/ui) are excluded so side-effect imports resolve.
  for (const name of componentNames) {
    assert.equal(loadItem(uiRegistryDir, name).type, "registry:ui");
  }
  for (const name of ["theme", "utils", "outside-click", "presence"]) {
    assert.ok(
      allNames.includes(name),
      `${name} must exist in the index to prove it is deliberately excluded`,
    );
    assert.ok(
      !componentNames.includes(name),
      `${name} is not a registry:ui component and must not be side-effect imported`,
    );
  }

  // Components outside the JSX-exercised representative subset must still be
  // bundled by the Vite build (F-053 hardening).
  for (const bundledOnly of ["radio", "toggle-group", "spinner", "switch", "progress"]) {
    assert.ok(
      componentNames.includes(bundledOnly),
      `${bundledOnly} must be in the exhaustive Vite-bundled component set`,
    );
  }
});

test("hidden leaf add-ons are side-effect imported at their colocated install paths", () => {
  const indexSet = new Set(allRegistryIndexNames(uiRegistryDir));
  const leafAddonNames = directlyInstallableUiNames(uiRegistryDir).filter(
    (name) => !indexSet.has(name),
  );
  const imports = addonSideEffectImports(uiRegistryDir, leafAddonNames);

  // The flat `@/components/ui/${name}` mapping the index components use does not
  // apply — add-on files colocate under code-block/ and logo/ subfolders, so the
  // Vite build only transforms them when imported at their real installed paths.
  assert.ok(
    imports.includes("@/components/ui/code-block/code-block-highlight"),
    "code-block-highlight add-on must be imported at its colocated path",
  );
  assert.ok(
    imports.includes("@/components/ui/logo/figlet"),
    "logo-figlet add-on must be imported at its colocated path",
  );
  assert.ok(
    !imports.includes("@/components/ui/code-block-highlight"),
    "add-on imports must not use the flat index mapping",
  );

  // Every specifier resolves to an installed .ts/.tsx module the build transforms.
  for (const name of leafAddonNames) {
    for (const file of loadItem(uiRegistryDir, name).files) {
      if (!/\.tsx?$/.test(file.path)) continue;
      const expected = `@/${installedFilePathForFile(file)
        .slice("src/".length)
        .replace(/\.tsx?$/, "")}`;
      assert.ok(
        imports.includes(expected),
        `add-on file ${file.path} must be side-effect imported`,
      );
    }
  }
});

test("standalone keys hooks unreachable through the UI graph are side-effect imported", () => {
  const allKeys = allRegistryIndexNames(keysRegistryDir);
  const imports = standaloneKeysHookImports(keysRegistryDir, allKeys, uiRegistryDir);

  // scroll-lock's entry hook is imported by no UI component, so it only enters
  // the Vite build through this side-effect import (F-053 hardening).
  assert.ok(
    imports.includes("@/hooks/use-scroll-lock"),
    "use-scroll-lock must be side-effect imported so the bundler transforms it",
  );

  // Entry hooks the UI graph already imports (dialog -> use-focus-restore,
  // dialog-shell -> use-focus-trap) reach the build through their components and
  // must not be redundantly re-imported here.
  for (const reached of ["use-focus-restore", "use-focus-trap", "use-navigation"]) {
    assert.ok(
      !imports.includes(`@/hooks/${reached}`),
      `${reached} already enters the build via a UI component and must not be re-imported`,
    );
  }

  // Only top-level entry hooks are imported; the utils/ helpers arrive with them.
  for (const specifier of imports) {
    assert.match(specifier, /^@\/hooks\/[a-z0-9-]+$/);
    assert.ok(!specifier.includes("/utils/"), `${specifier} must be a top-level entry hook`);
  }
});

test("keys entry hooks enumerate top-level src/hooks entries, not utils helpers", () => {
  const allKeys = allRegistryIndexNames(keysRegistryDir);
  const entryHooks = keysEntryHookNames(keysRegistryDir, allKeys);

  for (const hook of ["use-navigation", "use-focus-restore", "use-focus-trap", "use-scroll-lock"]) {
    assert.ok(entryHooks.includes(hook), `${hook} must be a keys entry hook`);
  }
  // utils/ helpers arrive transitively with their entry hooks and are never
  // imported directly, so they must not appear as entry hooks.
  for (const helper of ["focusable", "element-guards", "focus-restore"]) {
    assert.ok(!entryHooks.includes(helper), `${helper} is a utils helper, not an entry hook`);
  }
});

test("keys entry hook coverage guard flags a standalone hook the direct build never bundles", () => {
  const entryHooks = ["use-navigation", "use-scroll-lock"];
  const uiSources = ["import { useNavigation } from '@/hooks/use-navigation';"];

  // use-navigation reaches the build through a UI component; use-scroll-lock is
  // imported by no UI source, so the app must side-effect import it. When it does,
  // every entry hook is covered.
  const bundledApp = "import '@/hooks/use-scroll-lock';\nimport '@/components/ui/button';";
  assert.deepEqual(findUnbundledKeysEntryHooks(entryHooks, bundledApp, uiSources), []);

  // Dropping that side-effect import — an unwired standaloneKeysHookImports spread
  // or a derivation that stops covering it — leaves use-scroll-lock outside the
  // bundler's reach and must be reported rather than silently skipped.
  const unwiredApp = "import '@/components/ui/button';";
  assert.deepEqual(findUnbundledKeysEntryHooks(entryHooks, unwiredApp, uiSources), [
    "use-scroll-lock",
  ]);
});

test("smoke app renders every bundledUiComponents name so none is silently unbundled", () => {
  // bundledUiComponents are excluded from the side-effect import set on the
  // assumption each renders through real JSX. buildSmokeApp runs the guard, so a
  // future JSX edit that drops one fails here instead of creating a silent gap.
  const app = buildSmokeApp([]);
  for (const name of bundledUiComponents) {
    const tag = name.replace(/(^|-)([a-z])/g, (_match, _sep, char) => char.toUpperCase());
    assert.match(
      app,
      new RegExp(`<${tag}[\\s/>]`),
      `bundled component ${name} must render as <${tag}>`,
    );
  }
});

test("bundled-component guard fails loudly when a component is dropped from the JSX", () => {
  const app = buildSmokeApp([]);
  const withoutButton = app.replace(/<Button[\s\S]*?<\/Button>/g, "");
  assert.throws(
    () => assertBundledComponentsRendered(withoutButton),
    /bundledUiComponents lists "button"/,
  );
});

test("installedFilePathForFile maps every declared public file to a fixture path", () => {
  for (const registryDir of [uiRegistryDir, keysRegistryDir]) {
    for (const name of allRegistryIndexNames(registryDir)) {
      const item = loadItem(registryDir, name);
      for (const file of item.files ?? []) {
        assert.ok(
          installedFilePathForFile(file),
          `${name} file ${file.path} must map to a known install target`,
        );
      }
    }
  }
});

test("installedFilePathForFile resolves alias, project-root, and verbatim target shapes", () => {
  assert.equal(
    installedFilePathForFile({ path: "registry/ui/button/button.tsx", type: "registry:ui" }),
    "src/components/ui/button/button.tsx",
  );
  assert.equal(
    installedFilePathForFile({ path: "registry/hooks/use-x.ts", type: "registry:hook" }),
    "src/hooks/use-x.ts",
  );
  assert.equal(
    installedFilePathForFile({ path: "registry/lib/x.ts", type: "registry:lib" }),
    "src/lib/x.ts",
  );
  assert.equal(
    installedFilePathForFile({
      path: "styles/theme.css",
      target: "~/styles/theme.css",
      type: "registry:style",
    }),
    "styles/theme.css",
  );
  assert.equal(
    installedFilePathForFile({
      path: "src/hooks/use-scroll-lock.ts",
      target: "src/hooks/use-scroll-lock.ts",
      type: "registry:hook",
    }),
    "src/hooks/use-scroll-lock.ts",
  );
  // `@ui/` targets resolve under the fixture's `ui` alias (@/components/ui), not
  // verbatim — otherwise an @ui/ helper entering the exhaustive install set would
  // be looked up at a nonexistent `@ui/...` fixture path.
  assert.equal(
    installedFilePathForFile({
      path: "registry/ui/sidebar/sidebar-variants.ts",
      target: "@ui/sidebar/sidebar-variants.ts",
      type: "registry:lib",
    }),
    "src/components/ui/sidebar/sidebar-variants.ts",
  );
});

test("sidebar helpers map under the ui alias so the smoke can locate them", () => {
  // The coverage smoke locates each installed file through installedFilePathForFile
  // (assertAllPublicItemsInstalled) and side-effect imports the ui component set, so
  // the property it depends on is that the sidebar helpers install beside the sidebar
  // component under src/components/ui — not any particular target-string shape, which
  // registry-sidebar-target.test.ts owns.
  for (const name of ["sidebar-variants", "sidebar-intent"]) {
    const item = loadItem(uiRegistryDir, name);
    for (const file of item.files) {
      const installed = installedFilePathForFile(file);
      assert.ok(
        installed?.startsWith("src/components/ui/"),
        `${name} file ${file.path} must map under src/components/ui, got ${installed}`,
      );
    }
  }
});
