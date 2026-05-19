import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, relative, resolve } from "node:path";
import { extractDiffgazerKeysHookNames } from "../shared/registry-types.js";

type RegistryItem = {
  name: string;
  type: "registry:ui" | "registry:hook" | "registry:lib" | "registry:theme";
  files: Array<{ path: string }>;
  registryDependencies?: string[];
};

type Registry = {
  items: RegistryItem[];
};

const packageRoot = resolve(import.meta.dirname, "..");
const registryRoot = resolve(packageRoot, "registry");
const distRoot = resolve(packageRoot, "dist");
const declarationRoot = resolve(distRoot, "_types");
const registry = JSON.parse(
  readFileSync(resolve(registryRoot, "registry.json"), "utf-8"),
) as Registry;

/**
 * Mirror tsup's keys-hook detection so declaration imports of `@/hooks/use-<keys-hook>`
 * resolve to the published `@diffgazer/keys` specifier instead of an internal relative path.
 */
const DIFFGAZER_KEYS_HOOK_FILES = new Set(
  Array.from(extractDiffgazerKeysHookNames(registry.items)).map((name) => `use-${name}`),
);

function registryItemToDistKey(item: Pick<RegistryItem, "type" | "name">): string {
  if (item.type === "registry:hook") return `hooks/${item.name}`;
  if (item.type === "registry:lib") return `lib/${item.name}`;
  return `components/${item.name}`;
}

function registryItemToSourcePath(item: RegistryItem): string {
  return (
    item.files.find((file) => file.path.endsWith("index.ts"))?.path ??
    item.files[0]?.path ??
    ""
  );
}

function sourcePathToDeclarationPath(sourcePath: string): string {
  return resolve(
    declarationRoot,
    sourcePath.replace(/\.(tsx|ts)$/, ".d.ts"),
  );
}

function toSpecifier(fromFile: string, toDeclarationFile: string): string {
  const withoutExtension = toDeclarationFile.replace(/\.d\.ts$/, ".js");
  let specifier = relative(dirname(fromFile), withoutExtension).replaceAll("\\", "/");
  if (!specifier.startsWith(".")) specifier = `./${specifier}`;
  return specifier;
}

type AliasTarget =
  | { kind: "file"; path: string }
  | { kind: "external"; specifier: string };

function resolveAlias(alias: string): AliasTarget | null {
  if (alias.startsWith("@/lib/")) {
    const name = alias.slice("@/lib/".length);
    const file = resolve(declarationRoot, "registry/lib", `${name}.d.ts`);
    if (existsSync(file)) return { kind: "file", path: file };
    return { kind: "file", path: resolve(declarationRoot, "registry/lib", name, "index.d.ts") };
  }

  if (alias.startsWith("@/hooks/")) {
    const name = alias.slice("@/hooks/".length);
    if (DIFFGAZER_KEYS_HOOK_FILES.has(name)) {
      return { kind: "external", specifier: "@diffgazer/keys" };
    }
    return { kind: "file", path: resolve(declarationRoot, "registry/hooks", `${name}.d.ts`) };
  }

  if (alias.startsWith("@/components/ui/")) {
    const name = alias.slice("@/components/ui/".length);
    return { kind: "file", path: resolve(declarationRoot, "registry/ui", name, "index.d.ts") };
  }

  return null;
}

function hasKnownExtension(specifier: string): boolean {
  return /\.[cm]?[jt]sx?$|\.json$|\.css$/.test(specifier);
}

function rewriteDeclarationImports(filePath: string): void {
  const content = readFileSync(filePath, "utf-8");
  const rewriteSpecifier = (
    prefix: string,
    specifier: string,
    suffix: string,
    match: string,
  ): string => {
    const aliasTarget = resolveAlias(specifier);
    if (aliasTarget) {
      const rewrittenSpecifier =
        aliasTarget.kind === "external"
          ? aliasTarget.specifier
          : toSpecifier(filePath, aliasTarget.path);
      return `${prefix}${rewrittenSpecifier}${suffix}`;
    }

    if (specifier.startsWith(".") && !hasKnownExtension(specifier)) {
      return `${prefix}${specifier}.js${suffix}`;
    }

    return match;
  };

  let rewritten = content.replace(
    /(\b(?:from|import)\s+["'])([^"']+)(["'])/g,
    (match, prefix: string, specifier: string, suffix: string) =>
      rewriteSpecifier(prefix, specifier, suffix, match),
  );

  rewritten = rewritten.replace(
    /(\bimport\(\s*["'])([^"']+)(["']\s*\))/g,
    (match, prefix: string, specifier: string, suffix: string) =>
      rewriteSpecifier(prefix, specifier, suffix, match),
  );

  if (rewritten !== content) {
    writeFileSync(filePath, rewritten);
  }
}

function walkDeclarations(dir: string): string[] {
  const declarations: string[] = [];

  for (const entry of readdirSync(dir)) {
    const entryPath = resolve(dir, entry);
    if (statSync(entryPath).isDirectory()) {
      declarations.push(...walkDeclarations(entryPath));
    } else if (entryPath.endsWith(".d.ts")) {
      declarations.push(entryPath);
    }
  }

  return declarations;
}

function writePublicDeclaration(distKey: string, targetDeclaration: string): void {
  const publicDeclaration = resolve(distRoot, `${distKey}.d.ts`);
  mkdirSync(dirname(publicDeclaration), { recursive: true });
  writeFileSync(
    publicDeclaration,
    `export * from ${JSON.stringify(toSpecifier(publicDeclaration, targetDeclaration))};\n`,
  );
}

const tempDir = mkdtempSync(resolve(tmpdir(), "dg-ui-dts-"));

try {
  rmSync(declarationRoot, { recursive: true, force: true });
  mkdirSync(distRoot, { recursive: true });

  execFileSync(
    "pnpm",
    [
      "exec",
      "tsc",
      "-p",
      "tsconfig.json",
      "--emitDeclarationOnly",
      "--declaration",
      "--declarationMap",
      "false",
      "--rootDir",
      ".",
      "--outDir",
      tempDir,
    ],
    {
      cwd: packageRoot,
      stdio: "inherit",
    },
  );

  cpSync(tempDir, declarationRoot, { recursive: true });

  for (const declaration of walkDeclarations(declarationRoot)) {
    rewriteDeclarationImports(declaration);
  }

  for (const item of registry.items) {
    if (item.type === "registry:theme") continue;

    const sourcePath = registryItemToSourcePath(item);
    if (!sourcePath) {
      throw new Error(`Registry item has no source files: ${item.name}`);
    }

    const targetDeclaration = sourcePathToDeclarationPath(sourcePath);
    if (!existsSync(targetDeclaration)) {
      throw new Error(`Declaration was not emitted for ${item.name}: ${sourcePath}`);
    }

    writePublicDeclaration(registryItemToDistKey(item), targetDeclaration);
  }

  writePublicDeclaration(
    "lib/utils",
    resolve(declarationRoot, "registry/lib/utils.d.ts"),
  );
  writePublicDeclaration(
    "components/logo/figlet",
    resolve(declarationRoot, "registry/ui/logo/get-figlet-text.d.ts"),
  );
  writePublicDeclaration(
    "components/code-block/highlight",
    resolve(declarationRoot, "registry/ui/code-block/highlight.d.ts"),
  );
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
