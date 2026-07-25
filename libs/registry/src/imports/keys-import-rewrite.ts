import { extractImportSpecifiers, extractStaticNamedImports } from "./import-specifiers.js";
import { KEYS_PACKAGE_IMPORT_TARGETS } from "./keys-imports.js";

function specifierName(specifier: string): string {
  return (
    specifier
      .replace(/^type\s+/, "")
      .split(/\s+as\s+/)[0]
      ?.trim() ?? ""
  );
}

export interface RewriteKeysImportOptions {
  /** When set, skip rewriting to this hook basename to avoid shim self-imports. */
  shimHookBasename?: string;
  renderImport: (specifiers: string[], target: string, quote: string, indent: string) => string;
}

function groupSpecifiers(
  specifiersBlock: string,
  typePrefix: string,
): { grouped: Map<string, string[]>; unknown: string[] } {
  const grouped = new Map<string, string[]>();
  const unknown: string[] = [];

  for (const rawSpecifier of specifiersBlock.split(",")) {
    const specifier = rawSpecifier.trim();
    if (!specifier) continue;

    const target = KEYS_PACKAGE_IMPORT_TARGETS.get(specifierName(specifier));
    if (!target) {
      unknown.push(`${typePrefix}${specifier}`.trim());
      continue;
    }

    const specifiers = grouped.get(target) ?? [];
    specifiers.push(`${typePrefix}${specifier}`.trim());
    grouped.set(target, specifiers);
  }

  return { grouped, unknown };
}

function maskAllowedShimImport(content: string, shimHookBasename: string | undefined): string {
  if (!shimHookBasename) return content;

  const allowedRanges = extractStaticNamedImports(content).filter((declaration) => {
    if (declaration.specifier !== "@diffgazer/keys") return false;
    const specifiersBlock = content.slice(declaration.specifiersStart, declaration.specifiersEnd);
    const { grouped, unknown } = groupSpecifiers(specifiersBlock, declaration.typePrefix);
    const isStaticNamedSelfImport =
      unknown.length === 0 && grouped.size === 1 && grouped.has(shimHookBasename);
    return isStaticNamedSelfImport;
  });

  let masked = content;
  for (const { declarationStart, declarationEnd } of [...allowedRanges].reverse()) {
    const declaration = content.slice(declarationStart, declarationEnd);
    masked =
      masked.slice(0, declarationStart) +
      declaration.replace(/[^\r\n]/g, " ") +
      masked.slice(declarationEnd);
  }
  return masked;
}

function assertNoUnsupportedRootImport(
  content: string,
  shimHookBasename: string | undefined,
): void {
  const inspectedContent = maskAllowedShimImport(content, shimHookBasename);
  const residual = extractImportSpecifiers(inspectedContent).filter(
    ({ specifier }) => specifier === "@diffgazer/keys",
  );
  if (residual.length === 0) return;

  const forms = [...new Set(residual.map(({ kind }) => kind))].join(", ");
  throw new Error(
    `Unsupported @diffgazer/keys root import (${forms}). ` +
      "Direct-copy source must use mapped named imports so they can be rewritten to local hooks.",
  );
}

function renderShimImport(specifiers: string[], quote: string): string {
  return `import { ${specifiers.join(", ")} } from ${quote}@diffgazer/keys${quote};`;
}

export function rewriteKeysPackageImportsInContent(
  content: string,
  options: RewriteKeysImportOptions,
): string {
  let rewritten = content;
  const declarations = extractStaticNamedImports(content).filter(
    ({ specifier }) => specifier === "@diffgazer/keys",
  );

  for (const declaration of [...declarations].reverse()) {
    const specifiersBlock = content.slice(declaration.specifiersStart, declaration.specifiersEnd);
    const { grouped, unknown } = groupSpecifiers(specifiersBlock, declaration.typePrefix);

    if (unknown.length > 0) {
      throw new Error(
        `Unknown @diffgazer/keys import specifiers: ${unknown.join(", ")}. ` +
          "Add them to KEYS_PACKAGE_IMPORT_TARGETS in @diffgazer/registry.",
      );
    }

    const shimSpecifiers = options.shimHookBasename
      ? grouped.get(options.shimHookBasename)
      : undefined;
    if (shimSpecifiers && grouped.size === 1) continue;

    const replacementParts = [...grouped.entries()]
      .filter(([target]) => !options.shimHookBasename || target !== options.shimHookBasename)
      .map(([target, specifiers]) =>
        options.renderImport(specifiers, target, declaration.quote, ""),
      );
    if (shimSpecifiers) {
      replacementParts.unshift(renderShimImport(shimSpecifiers, declaration.quote));
    }
    const replacement = replacementParts.join("\n");

    if (replacement === "") continue;
    rewritten =
      rewritten.slice(0, declaration.declarationStart) +
      replacement +
      rewritten.slice(declaration.declarationEnd);
  }

  assertNoUnsupportedRootImport(rewritten, options.shimHookBasename);
  return rewritten;
}
