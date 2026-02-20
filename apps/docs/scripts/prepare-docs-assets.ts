import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, isAbsolute, resolve } from "node:path";

export interface PrepareDocsAssetsOptions {
  workspaceRoot: string;
  appRoot: string;
  docsHost: string;
}

export interface PreparedLibrarySource {
  id: "diff-ui" | "keyscope";
  packageName: string;
  version: string;
  sourceRoot: string;
}

type ResolvedLibraryRoot = {
  root: string;
  source: "package" | "local";
};

const require = createRequire(import.meta.url);

const LOCAL_ROOT_CANDIDATES = {
  "diff-ui": ["../diff-ui", "../diffgazer-workspace/diff-ui"],
  keyscope: ["../keyscope", "../diffgazer-workspace/keyscope"],
} as const;

const REWRITE_FILE_EXTENSIONS = new Set([".md", ".mdx", ".json"]);

function normalizeDocsHost(host: string): string {
  return host.replace(/\/+$/, "");
}

function ensureDirExists(path: string, label: string, packageName: string): void {
  if (!existsSync(path)) {
    throw new Error(`Required directory for "${packageName}" not found: ${label} (${path})`);
  }
}

function resetDirectory(path: string): void {
  rmSync(path, { recursive: true, force: true });
  mkdirSync(path, { recursive: true });
}

function copyDirectory(from: string, to: string): void {
  resetDirectory(to);
  cpSync(from, to, { recursive: true, force: true });
}

function readPackageVersion(packageRoot: string): string {
  const packageJsonPath = resolve(packageRoot, "package.json");
  if (!existsSync(packageJsonPath)) return "0.0.0";
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as { version?: string };
  return packageJson.version ?? "0.0.0";
}

function resolvePathFromWorkspaceRoot(workspaceRoot: string, value: string): string {
  if (isAbsolute(value)) return value;
  return resolve(workspaceRoot, value);
}

function resolveLibraryRootWorkspaceFirst(options: {
  workspaceRoot: string;
  packageName: string;
  localRootCandidates: readonly string[];
  envOverrideValue: string | undefined;
  envOverrideName: string;
}): ResolvedLibraryRoot {
  const checkedLocalRoots: string[] = [];

  if (options.envOverrideValue) {
    const overrideRoot = resolvePathFromWorkspaceRoot(options.workspaceRoot, options.envOverrideValue);
    if (!existsSync(overrideRoot)) {
      throw new Error(
        `Environment override ${options.envOverrideName} points to missing path: ${overrideRoot}`,
      );
    }

    return { root: overrideRoot, source: "local" };
  }

  for (const candidate of options.localRootCandidates) {
    const candidateRoot = resolve(options.workspaceRoot, candidate);
    checkedLocalRoots.push(candidateRoot);
    if (existsSync(candidateRoot)) {
      return { root: candidateRoot, source: "local" };
    }
  }

  try {
    const packageJsonPath = require.resolve(`${options.packageName}/package.json`, {
      paths: [options.workspaceRoot],
    });
    return { root: dirname(packageJsonPath), source: "package" };
  } catch {
    throw new Error(
      `Unable to resolve "${options.packageName}". Checked local roots: ${checkedLocalRoots.join(", ")}`,
    );
  }
}

function rewriteDocsHostReferences(content: string, docsHost: string): string {
  return content
    .replaceAll("https://diffui.dev/r/keyscope", `${docsHost}/r/keyscope`)
    .replaceAll("https://diffui.dev/r", `${docsHost}/r/diff-ui`);
}

function replaceDocsHostInDirectory(dir: string, docsHost: string): void {
  if (!existsSync(dir)) return;

  for (const name of readdirSync(dir)) {
    const full = resolve(dir, name);
    const stats = statSync(full);

    if (stats.isDirectory()) {
      replaceDocsHostInDirectory(full, docsHost);
      continue;
    }

    if (!REWRITE_FILE_EXTENSIONS.has(extname(name))) continue;

    const content = readFileSync(full, "utf-8");
    const updated = rewriteDocsHostReferences(content, docsHost);

    if (updated !== content) {
      writeFileSync(full, updated);
    }
  }
}

function rewriteDemoIndexImports(appRoot: string): void {
  const demoIndexPath = resolve(appRoot, "src/generated/demo-index.ts");
  if (!existsSync(demoIndexPath)) return;

  const content = readFileSync(demoIndexPath, "utf-8");
  const updated = content.replace(
    /(?:\.\.\/){4}registry\/examples\//g,
    "../../vendor/registry/examples/",
  );

  if (updated !== content) {
    writeFileSync(demoIndexPath, updated);
  }
}

function slugToTitle(slug: string): string {
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function toSingleLine(value: string): string {
  return value.replace(/\r?\n/g, " ").trim();
}

function extractMarkdownTitle(content: string): string | null {
  const match = content.match(/^#\s+(.+)$/m);
  if (!match) return null;
  const raw = match[1]?.trim();
  if (!raw) return null;
  return raw.replace(/\s+#*$/, "").trim();
}

function addFrontmatterTitle(content: string, title: string): string {
  const normalized = title.replace(/"/g, '\\"');
  return `---\ntitle: "${normalized}"\n---\n\n${content}`;
}

function shouldIncludeKeyscopeDoc(relativePath: string): boolean {
  if (relativePath.startsWith("assets/")) return false;
  if (relativePath.startsWith("design/")) return false;
  return relativePath.endsWith(".md") || relativePath.endsWith(".mdx");
}

function copyKeyscopeDocsToGeneratedContent(options: {
  docsSource: string;
  generatedDocsRoot: string;
}): void {
  const keyscopeOutRoot = resolve(options.generatedDocsRoot, "keyscope");
  resetDirectory(keyscopeOutRoot);

  function walk(fromDir: string, relativeDir: string): void {
    for (const entry of readdirSync(fromDir, { withFileTypes: true })) {
      const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
      const fullPath = resolve(fromDir, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath, relativePath);
        continue;
      }

      if (!shouldIncludeKeyscopeDoc(relativePath)) continue;

      const relativeWithoutExt = relativePath.replace(/\.(md|mdx)$/i, "");
      const outputPath = resolve(keyscopeOutRoot, `${relativeWithoutExt}.mdx`);
      mkdirSync(dirname(outputPath), { recursive: true });

      const source = readFileSync(fullPath, "utf-8");
      const withFrontmatter = source.startsWith("---\n")
        ? source
        : addFrontmatterTitle(
            source,
            toSingleLine(extractMarkdownTitle(source) ?? slugToTitle(relativeWithoutExt.split("/").pop() ?? "doc")),
          );

      writeFileSync(outputPath, withFrontmatter);
    }
  }

  walk(options.docsSource, "");
}

function writeKeyscopeMetaTree(rootDir: string): void {
  function writeMetaForDir(dir: string, isRoot: boolean): void {
    const files: string[] = [];
    const folders: string[] = [];

    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "meta.json") continue;
      const fullPath = resolve(dir, entry.name);

      if (entry.isDirectory()) {
        writeMetaForDir(fullPath, false);
        folders.push(entry.name);
        continue;
      }

      if (!entry.isFile() || !entry.name.endsWith(".mdx")) continue;
      files.push(entry.name.replace(/\.mdx$/, ""));
    }

    files.sort((a, b) => a.localeCompare(b));
    folders.sort((a, b) => a.localeCompare(b));

    const orderedFiles =
      files.includes("index")
        ? ["index", ...files.filter((name) => name !== "index")]
        : files;

    const pages = [
      ...orderedFiles,
      ...folders.map((name) => `...${name}`),
    ];

    writeFileSync(
      resolve(dir, "meta.json"),
      JSON.stringify(
        {
          title: isRoot ? "Keyscope" : slugToTitle(dir.split("/").pop() ?? "Docs"),
          pages,
        },
        null,
        2,
      ),
    );
  }

  if (!existsSync(rootDir)) return;
  writeMetaForDir(rootDir, true);
}

function ensureRootMetaIncludesKeyscope(generatedDocsRoot: string): void {
  const rootMetaPath = resolve(generatedDocsRoot, "meta.json");
  if (!existsSync(rootMetaPath)) return;

  const rootMeta = JSON.parse(readFileSync(rootMetaPath, "utf-8")) as {
    title?: string;
    root?: boolean;
    pages?: unknown;
  };

  const currentPages = Array.isArray(rootMeta.pages)
    ? rootMeta.pages.filter((entry): entry is string => typeof entry === "string")
    : [];
  const filtered = currentPages.filter(
    (entry) => entry !== "---Keyscope---" && entry !== "...keyscope",
  );
  const insertAt = filtered.indexOf("---CLI---");

  if (insertAt >= 0) {
    filtered.splice(insertAt, 0, "---Keyscope---", "...keyscope");
  } else {
    filtered.push("---Keyscope---", "...keyscope");
  }

  writeFileSync(
    rootMetaPath,
    JSON.stringify(
      {
        ...rootMeta,
        pages: filtered,
      },
      null,
      2,
    ),
  );
}

function prepareDiffUi(options: {
  workspaceRoot: string;
  appRoot: string;
  docsHost: string;
}): PreparedLibrarySource {
  const resolved = resolveLibraryRootWorkspaceFirst({
    workspaceRoot: options.workspaceRoot,
    packageName: "diffui",
    localRootCandidates: LOCAL_ROOT_CANDIDATES["diff-ui"],
    envOverrideName: "DIFFUI_ROOT",
    envOverrideValue: process.env.DIFFUI_ROOT,
  });

  const packageRoot = resolved.root;
  const version = readPackageVersion(packageRoot);

  const registrySource =
    resolved.source === "package"
      ? resolve(packageRoot, "dist/artifacts/registry")
      : resolve(packageRoot, "public/r");
  const docsSource =
    resolved.source === "package"
      ? resolve(packageRoot, "dist/artifacts/docs")
      : resolve(packageRoot, "docs/content");
  const generatedSource =
    resolved.source === "package"
      ? resolve(packageRoot, "dist/artifacts/generated")
      : resolve(packageRoot, "docs/generated");
  const sourceRegistrySource =
    resolved.source === "package"
      ? resolve(packageRoot, "dist/artifacts/source/registry")
      : resolve(packageRoot, "registry");
  const sourceStylesSource =
    resolved.source === "package"
      ? resolve(packageRoot, "dist/artifacts/source/styles")
      : resolve(packageRoot, "styles");

  ensureDirExists(registrySource, "registry artifacts", "diffui");
  ensureDirExists(docsSource, "docs artifacts", "diffui");
  ensureDirExists(generatedSource, "generated docs data", "diffui");
  ensureDirExists(sourceRegistrySource, "source registry", "diffui");
  ensureDirExists(sourceStylesSource, "source styles", "diffui");

  copyDirectory(registrySource, resolve(options.appRoot, "public/r/diff-ui"));
  copyDirectory(docsSource, resolve(options.appRoot, "content/generated-docs"));
  copyDirectory(generatedSource, resolve(options.appRoot, "src/generated"));
  rewriteDemoIndexImports(options.appRoot);
  copyDirectory(sourceRegistrySource, resolve(options.appRoot, "vendor/registry"));
  copyDirectory(sourceStylesSource, resolve(options.appRoot, "vendor/styles"));

  replaceDocsHostInDirectory(resolve(options.appRoot, "content/generated-docs"), options.docsHost);
  replaceDocsHostInDirectory(resolve(options.appRoot, "public/r/diff-ui"), options.docsHost);
  replaceDocsHostInDirectory(resolve(options.appRoot, "vendor/registry"), options.docsHost);

  return {
    id: "diff-ui",
    packageName: "diffui",
    version,
    sourceRoot: packageRoot,
  };
}

function prepareKeyscope(options: {
  workspaceRoot: string;
  appRoot: string;
}): PreparedLibrarySource {
  const resolved = resolveLibraryRootWorkspaceFirst({
    workspaceRoot: options.workspaceRoot,
    packageName: "keyscope",
    localRootCandidates: LOCAL_ROOT_CANDIDATES.keyscope,
    envOverrideName: "KEYSCOPE_ROOT",
    envOverrideValue: process.env.KEYSCOPE_ROOT,
  });
  const packageRoot = resolved.root;
  const version = readPackageVersion(packageRoot);

  const registrySource = resolve(packageRoot, "public/r");
  const docsSource = resolve(packageRoot, "docs");
  const sourceCodeSource = resolve(packageRoot, "src");

  ensureDirExists(registrySource, "registry artifacts", "keyscope");
  ensureDirExists(docsSource, "docs directory", "keyscope");
  ensureDirExists(sourceCodeSource, "source directory", "keyscope");

  copyDirectory(registrySource, resolve(options.appRoot, "public/r/keyscope"));
  rmSync(resolve(options.appRoot, "public/docs/keyscope"), { recursive: true, force: true });
  copyKeyscopeDocsToGeneratedContent({
    docsSource,
    generatedDocsRoot: resolve(options.appRoot, "content/generated-docs"),
  });
  const keyscopeDocsRoot = resolve(options.appRoot, "content/generated-docs/keyscope");
  writeKeyscopeMetaTree(keyscopeDocsRoot);
  ensureRootMetaIncludesKeyscope(resolve(options.appRoot, "content/generated-docs"));
  const vendorKeyscopeSource = resolve(options.appRoot, "vendor/keyscope/src");
  resetDirectory(vendorKeyscopeSource);

  const runtimeDirs = ["context", "hooks", "internal", "providers", "utils"] as const;
  for (const dir of runtimeDirs) {
    const from = resolve(sourceCodeSource, dir);
    if (existsSync(from)) {
      cpSync(from, resolve(vendorKeyscopeSource, dir), { recursive: true, force: true });
    }
  }

  const runtimeFiles = ["index.ts", "types.ts"] as const;
  for (const file of runtimeFiles) {
    const from = resolve(sourceCodeSource, file);
    if (existsSync(from)) {
      cpSync(from, resolve(vendorKeyscopeSource, file), { force: true });
    }
  }

  ensureDirExists(resolve(vendorKeyscopeSource, "index.ts"), "vendored keyscope entry", "keyscope");

  return {
    id: "keyscope",
    packageName: "keyscope",
    version,
    sourceRoot: packageRoot,
  };
}

export function prepareDocsAssets(options: PrepareDocsAssetsOptions): PreparedLibrarySource[] {
  const docsHost = normalizeDocsHost(options.docsHost);

  resetDirectory(resolve(options.appRoot, "public/r"));

  const diffUi = prepareDiffUi({
    workspaceRoot: options.workspaceRoot,
    appRoot: options.appRoot,
    docsHost,
  });
  const keyscope = prepareKeyscope({
    workspaceRoot: options.workspaceRoot,
    appRoot: options.appRoot,
  });

  const summary = [diffUi, keyscope];
  writeFileSync(resolve(options.appRoot, "src/generated/library-sources.json"), JSON.stringify(summary, null, 2));

  return summary;
}

function runCli(): void {
  const appRoot = resolve(import.meta.dirname, "..");
  const workspaceRoot = resolve(appRoot, "../..");
  const docsHost = process.env.DOCS_HOST ?? "https://docs.diffgazer.com";

  const summary = prepareDocsAssets({ workspaceRoot, appRoot, docsHost });
  for (const library of summary) {
    console.log(`Prepared ${library.id} (${library.packageName}@${library.version}) from ${library.sourceRoot}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    runCli();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }
}
