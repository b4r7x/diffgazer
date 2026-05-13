import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export function quoteArgs(args) {
  return args.map((arg) => JSON.stringify(arg)).join(" ");
}

export function packageNameFromSpec(spec) {
  if (spec.startsWith("/") || spec.startsWith(".")) return null;
  if (spec.startsWith("@")) {
    const [scope, rest = ""] = spec.split("/");
    const name = rest.split("@")[0];
    return name ? `${scope}/${name}` : null;
  }
  return spec.split("@")[0] || null;
}

export function networkAllowed() {
  return process.env.DIFFGAZER_SMOKE_ALLOW_NETWORK === "1";
}

export function pnpmAddFlags() {
  return networkAllowed()
    ? ["--fetch-retries=0"]
    : ["--offline", "--fetch-retries=0"];
}

export function resolveLocalDependency(root, packageName) {
  for (const dir of ["apps/web", "libs/ui", "libs/keys", "."]) {
    const depPath = resolve(root, dir, "node_modules", ...packageName.split("/"));
    if (existsSync(depPath)) return `link:${realpathSync(depPath)}`;
  }
  throw new Error(`Cannot resolve local dependency for smoke test: ${packageName}`);
}

function viteFixtureDependencySpecs(root) {
  return [
    "react",
    "react-dom",
    "@types/react",
    "@types/react-dom",
    "typescript",
    "vite",
    "@vitejs/plugin-react",
    "tailwindcss",
    "@tailwindcss/vite",
    "class-variance-authority",
    "clsx",
    "tailwind-merge",
  ].map((packageName) => resolveLocalDependency(root, packageName));
}

export function installViteFixtureDeps(root, fixture) {
  run(`pnpm add --offline --fetch-retries=0 ${quoteArgs(viteFixtureDependencySpecs(root))}`, fixture);
}

export function writeViteFixture(fixture, options = {}) {
  const {
    name = "dgadd-smoke",
    packageManager,
    withLibUtils = false,
    indexCss,
    componentsJson = false,
    componentRegistries,
  } = options;
  mkdirSync(resolve(fixture, "src"), { recursive: true });
  if (withLibUtils) {
    mkdirSync(resolve(fixture, "src/lib"), { recursive: true });
  }

  const packageJson = {
    name,
    private: true,
    type: "module",
    ...(packageManager ? { packageManager } : {}),
    scripts: {
      typecheck: "tsc -p tsconfig.json",
      build: "vite build",
    },
  };

  writeFileSync(resolve(fixture, "package.json"), JSON.stringify(packageJson, null, 2));
  writeFileSync(resolve(fixture, "tsconfig.json"), JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      lib: ["DOM", "DOM.Iterable", "ES2022"],
      module: "ESNext",
      moduleResolution: "Bundler",
      jsx: "react-jsx",
      strict: true,
      noEmit: true,
      skipLibCheck: false,
      baseUrl: ".",
      paths: { "@/*": ["./src/*"] },
    },
    include: ["src"],
  }, null, 2));
  writeFileSync(
    resolve(fixture, "vite.config.mjs"),
    [
      "import { defineConfig } from 'vite';",
      "import react from '@vitejs/plugin-react';",
      "import tailwindcss from '@tailwindcss/vite';",
      "",
      "export default defineConfig({",
      "  plugins: [react(), tailwindcss()],",
      "  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },",
      "});",
      "",
    ].join("\n"),
  );
  writeFileSync(resolve(fixture, "index.html"), `<div id="root"></div><script type="module" src="/src/main.tsx"></script>\n`);

  if (withLibUtils) {
    writeFileSync(resolve(fixture, "src/lib/utils.ts"), [
      'import { type ClassValue, clsx } from "clsx";',
      'import { twMerge } from "tailwind-merge";',
      "",
      "export function cn(...inputs: ClassValue[]) {",
      "  return twMerge(clsx(inputs));",
      "}",
      "",
    ].join("\n"));
  }

  if (indexCss) {
    writeFileSync(resolve(fixture, "src/index.css"), Array.isArray(indexCss) ? indexCss.join("\n") : indexCss);
  }

  if (componentsJson) {
    writeFileSync(resolve(fixture, "components.json"), JSON.stringify({
      $schema: "https://ui.shadcn.com/schema.json",
      ...(componentRegistries ? { registries: componentRegistries } : {}),
      style: "new-york",
      rsc: false,
      tsx: true,
      tailwind: {
        config: "",
        css: "src/index.css",
        baseColor: "neutral",
        cssVariables: true,
        prefix: "",
      },
      iconLibrary: "lucide",
      aliases: {
        components: "@/components",
        utils: "@/lib/utils",
        ui: "@/components/ui",
        lib: "@/lib",
        hooks: "@/hooks",
      },
    }, null, 2));
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

  writeFileSync(resolve(fixture, "package.json"), JSON.stringify({
    name,
    private: true,
    type: "module",
  }, null, 2));
  writeFileSync(resolve(fixture, "tsconfig.json"), JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      lib: ["DOM", "DOM.Iterable", "ES2022"],
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
  }, null, 2));
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
    "/// <reference types=\"next\" />\n/// <reference types=\"next/image-types/global\" />\n",
  );
}

export function uiSmokeAppBody(label) {
  return [
    "    <main className=\"min-h-screen bg-background text-foreground p-6\">",
    `      <Button variant=\"primary\">${label} Button</Button>`,
    "      <Dialog defaultOpen>",
    "        <DialogContent>",
    `          <DialogHeader><DialogTitle>${label} Dialog</DialogTitle></DialogHeader>`,
    "          <DialogBody><p className=\"text-sm text-muted-foreground\">Dialog content</p></DialogBody>",
    "          <DialogFooter><DialogClose variant=\"ghost\">Close</DialogClose></DialogFooter>",
    "        </DialogContent>",
    "      </Dialog>",
    "      <Select defaultOpen defaultValue=\"main\" width=\"md\">",
    "        <SelectTrigger><SelectValue placeholder=\"Branch\" /></SelectTrigger>",
    "        <SelectContent>",
    "          <SelectItem value=\"main\">main</SelectItem>",
    "          <SelectItem value=\"develop\">develop</SelectItem>",
    "        </SelectContent>",
    "      </Select>",
    "    </main>",
  ];
}

export function skipMissingSmokeDeps(label, missing) {
  if (missing.length === 0) return false;

  if (process.env.DIFFGAZER_SMOKE_STRICT_SKIPS === "1") {
    throw new Error(
      `Required smoke dependencies missing for ${label}: ${missing.join(", ")}. `
      + "Install them locally or set DIFFGAZER_SMOKE_ALLOW_NETWORK=1.",
    );
  }

  console.log(
    `SKIP: ${label} (missing local dependencies: ${missing.join(", ")}; `
    + "set DIFFGAZER_SMOKE_ALLOW_NETWORK=1 to install them, or DIFFGAZER_SMOKE_STRICT_SKIPS=1 to fail on skips)",
  );
  return true;
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
    expected = [".bg-primary", ".w-64", "--tui-bg", "dialog::backdrop"],
  } = options;
  const css = readBuiltCss(fixture, outputDir);

  for (const value of expected) {
    if (!css.includes(value)) {
      throw new Error(`${label} CSS is missing ${value}`);
    }
  }
}

export function run(cmd, cwdOrOptions) {
  const options = typeof cwdOrOptions === "string" ? { cwd: cwdOrOptions } : (cwdOrOptions ?? {});
  return execSync(cmd, {
    encoding: "utf8",
    cwd: options.cwd,
    env: options.env ? { ...process.env, ...options.env } : undefined,
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });
}
