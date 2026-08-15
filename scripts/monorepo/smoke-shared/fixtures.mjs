import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { TAILWIND_V4_SPEC } from "./dependencies.mjs";

export function joinLines(...lines) {
  return lines.join("\n");
}

// shadcn resolves every install target from these five aliases and from whether
// the project has a `src/` directory, so both are fixture inputs: a registry
// that installs cleanly under the defaults can still break under another cell.
export const DEFAULT_FIXTURE_ALIASES = {
  components: "@/components",
  utils: "@/lib/utils",
  ui: "@/components/ui",
  lib: "@/lib",
  hooks: "@/hooks",
};

// `@/x` resolves to `src/x` in a src-layout project and to `x` in a root-layout
// one, matching the tsconfig paths and Vite alias written below.
export function fixtureAliasPath(alias, isSrcDir = true) {
  const relative = alias.replace(/^@\//, "");
  return isSrcDir ? `src/${relative}` : relative;
}

export function fixtureEntryPath(isSrcDir = true) {
  return isSrcDir ? "src/main.tsx" : "main.tsx";
}

export function writeViteFixture(fixture, options = {}) {
  const {
    name = "dgadd-smoke",
    packageManager,
    withLibUtils = false,
    indexCss,
    componentsJson = false,
    componentRegistries,
    aliases = DEFAULT_FIXTURE_ALIASES,
    isSrcDir = true,
  } = options;
  const sourceDir = isSrcDir ? "src" : ".";
  const indexCssPath = isSrcDir ? "src/index.css" : "index.css";
  const utilsPath = `${fixtureAliasPath(aliases.utils, isSrcDir)}.ts`;
  mkdirSync(resolve(fixture, sourceDir), { recursive: true });
  if (withLibUtils) {
    mkdirSync(dirname(resolve(fixture, utilsPath)), { recursive: true });
  }

  const packageJson = {
    name,
    private: true,
    type: "module",
    ...(packageManager ? { packageManager } : {}),
    devDependencies: { tailwindcss: TAILWIND_V4_SPEC },
    scripts: {
      typecheck: "tsc -p tsconfig.json",
      build: "vite build",
    },
  };

  writeFileSync(resolve(fixture, "package.json"), JSON.stringify(packageJson, null, 2));
  writeFileSync(
    resolve(fixture, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          lib: ["DOM", "DOM.Iterable", "ES2023"],
          module: "ESNext",
          moduleResolution: "Bundler",
          jsx: "react-jsx",
          strict: true,
          noEmit: true,
          skipLibCheck: false,
          baseUrl: ".",
          paths: { "@/*": [isSrcDir ? "./src/*" : "./*"] },
        },
        include: [sourceDir],
      },
      null,
      2,
    ),
  );
  writeFileSync(
    resolve(fixture, "vite.config.mjs"),
    joinLines(
      "import { defineConfig } from 'vite';",
      "import react from '@vitejs/plugin-react';",
      "import tailwindcss from '@tailwindcss/vite';",
      "",
      "export default defineConfig({",
      "  plugins: [react(), tailwindcss()],",
      `  resolve: { alias: { '@': new URL('${isSrcDir ? "./src" : "."}', import.meta.url).pathname } },`,
      "});",
      "",
    ),
  );
  writeFileSync(
    resolve(fixture, "index.html"),
    `<div id="root"></div><script type="module" src="/${fixtureEntryPath(isSrcDir)}"></script>\n`,
  );

  if (withLibUtils) {
    writeFileSync(
      resolve(fixture, utilsPath),
      joinLines(
        'import { type ClassValue, clsx } from "clsx";',
        'import { twMerge } from "tailwind-merge";',
        "",
        "export function cn(...inputs: ClassValue[]) {",
        "  return twMerge(clsx(inputs));",
        "}",
        "",
      ),
    );
  }

  if (indexCss) {
    writeFileSync(
      resolve(fixture, indexCssPath),
      Array.isArray(indexCss) ? indexCss.join("\n") : indexCss,
    );
  }

  if (componentsJson) {
    writeFileSync(
      resolve(fixture, "components.json"),
      JSON.stringify(
        {
          $schema: "https://ui.shadcn.com/schema.json",
          ...(componentRegistries ? { registries: componentRegistries } : {}),
          style: "new-york",
          rsc: false,
          tsx: true,
          tailwind: {
            config: "",
            css: indexCssPath,
            baseColor: "neutral",
            cssVariables: true,
            prefix: "",
          },
          iconLibrary: "lucide",
          aliases,
        },
        null,
        2,
      ),
    );
  }
}

export function writeNextFixture(fixture, options = {}) {
  const {
    root,
    name = "dgadd-next-smoke",
    withSrc = false,
    paths = false,
    include = withSrc
      ? ["next-env.d.ts", "app/**/*.ts", "app/**/*.tsx", "src/**/*.ts", "src/**/*.tsx"]
      : ["next-env.d.ts", "app/**/*.ts", "app/**/*.tsx"],
  } = options;

  mkdirSync(resolve(fixture, "app"), { recursive: true });
  if (withSrc) {
    mkdirSync(resolve(fixture, "src"), { recursive: true });
  }

  writeFileSync(
    resolve(fixture, "package.json"),
    JSON.stringify(
      {
        name,
        private: true,
        type: "module",
      },
      null,
      2,
    ),
  );
  writeFileSync(
    resolve(fixture, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          lib: ["DOM", "DOM.Iterable", "ES2023"],
          module: "ESNext",
          moduleResolution: "Bundler",
          jsx: "preserve",
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          esModuleInterop: true,
          allowJs: false,
          resolveJsonModule: true,
          isolatedModules: true,
          incremental: true,
          ...(paths ? { baseUrl: ".", paths: { "@/*": ["./src/*"] } } : {}),
          plugins: [{ name: "next" }],
        },
        include,
        exclude: ["node_modules"],
      },
      null,
      2,
    ),
  );
  writeFileSync(
    resolve(fixture, "next.config.mjs"),
    [
      "export default {",
      ...(root ? [`  turbopack: { root: ${JSON.stringify(root)} },`] : []),
      "};",
      "",
    ].join("\n"),
  );
  writeFileSync(
    resolve(fixture, "postcss.config.mjs"),
    "export default { plugins: { '@tailwindcss/postcss': {} } };\n",
  );
  writeFileSync(
    resolve(fixture, "next-env.d.ts"),
    '/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n',
  );
}

export function uiSmokeAppBody(label) {
  return [
    '    <main className="min-h-screen bg-background text-foreground p-6">',
    `      <Button variant="primary">${label} Button</Button>`,
    "      <Dialog defaultOpen>",
    "        <DialogContent>",
    `          <DialogHeader><DialogTitle>${label} Dialog</DialogTitle></DialogHeader>`,
    '          <DialogBody><p className="text-sm text-muted-foreground">Dialog content</p></DialogBody>',
    '          <DialogFooter><DialogClose variant="ghost">Close</DialogClose></DialogFooter>',
    "          <DialogCloseIcon />",
    "        </DialogContent>",
    "      </Dialog>",
    '      <Select defaultOpen defaultValue="main" width="md">',
    '        <SelectTrigger><SelectValue placeholder="Branch" /></SelectTrigger>',
    "        <SelectContent>",
    '          <SelectItem value="main">main</SelectItem>',
    '          <SelectItem value="develop">develop</SelectItem>',
    "        </SelectContent>",
    "      </Select>",
    "    </main>",
  ];
}

function listFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = resolve(dir, entry);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

function readBuiltCss(fixture, outputDir = "dist") {
  return listFiles(resolve(fixture, outputDir))
    .filter((path) => path.endsWith(".css"))
    .map((path) => readFileSync(path, "utf-8"))
    .join("\n");
}

export function assertBuiltCss(fixture, options = {}) {
  const {
    outputDir = "dist",
    label = "built",
    // One marker per contract: a theme-mapped colour utility generated from a scanned
    // component source (.bg-action, the single filled CTA), a component size utility
    // (.w-64), the theme token layer (--base-bg), and aggregated component global CSS.
    expected = [".bg-action", ".w-64", "--base-bg", "dialog::backdrop"],
  } = options;
  const css = readBuiltCss(fixture, outputDir);

  for (const value of expected) {
    if (!css.includes(value)) {
      throw new Error(`${label} CSS is missing ${value}`);
    }
  }
}
