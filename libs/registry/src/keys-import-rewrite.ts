import { KEYS_PACKAGE_IMPORT_TARGETS } from "./keys-imports.js";

const KEYS_PACKAGE_IMPORT_RE =
  /import\s+(type\s+)?\{([^}]+)\}\s+from\s+(["'])@diffgazer\/keys\3\s*;?/g;

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

export function rewriteKeysPackageImportsInContent(
  content: string,
  options: RewriteKeysImportOptions,
): string {
  return content.replace(
    KEYS_PACKAGE_IMPORT_RE,
    (match, typePrefix = "", specifiersBlock, quote) => {
      const indentMatch = /^\s*/.exec(match);
      const indent = indentMatch?.[0] ?? "";
      const { grouped, unknown } = groupSpecifiers(specifiersBlock ?? "", typePrefix);

      if (unknown.length > 0) {
        throw new Error(
          `Unknown @diffgazer/keys import specifiers: ${unknown.join(", ")}. ` +
            "Add them to KEYS_PACKAGE_IMPORT_TARGETS in @diffgazer/registry.",
        );
      }

      const rewritten = [...grouped.entries()]
        .filter(([target]) => !options.shimHookBasename || target !== options.shimHookBasename)
        .map(([target, specifiers]) => options.renderImport(specifiers, target, quote, indent));

      return rewritten.length > 0 ? rewritten.join("\n") : match;
    },
  );
}
