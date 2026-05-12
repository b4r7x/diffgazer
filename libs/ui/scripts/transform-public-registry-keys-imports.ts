import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const KEYS_PACKAGE_IMPORT_TARGETS = new Map<string, string>([
  ["useNavigation", "use-navigation"],
  ["useFocusRestore", "use-focus-restore"],
  ["useFocusTrap", "use-focus-trap"],
  ["useScrollLock", "use-scroll-lock"],
  ["getNavigationItems", "utils/navigation-items"],
  ["containsActiveElement", "utils/navigation-items"],
  ["findNavigationItemByValue", "utils/navigation-items"],
  ["focusNavigationItem", "utils/navigation-items"],
  ["getFocusedNavigationValue", "utils/navigation-items"],
  ["getNavigationItemProps", "utils/navigation-items"],
  ["NAVIGATION_ITEM_ATTRIBUTE", "utils/navigation-items"],
  ["getFocusableElements", "utils/focusable"],
  ["getFirstFocusableElement", "utils/focusable"],
  ["getTabbableElements", "utils/focusable"],
  ["isFocusable", "utils/focusable"],
  ["isEditableElement", "utils/keyboard-utils"],
  ["isInputElement", "utils/keyboard-utils"],
  ["getRestorableFocusTarget", "utils/focus-restore"],
  ["restoreFocus", "utils/focus-restore"],
  ["getVerticalArrowDirection", "utils/navigation-directions"],
  ["toVerticalBoundaryDirection", "utils/navigation-directions"],
]);

function specifierName(specifier: string): string {
  return specifier
    .replace(/^type\s+/, "")
    .split(/\s+as\s+/)[0]
    ?.trim() ?? "";
}

function renderImport(specifiers: string[], target: string, quote: string): string {
  return `import { ${specifiers.join(", ")} } from ${quote}@/hooks/${target}${quote};`;
}

function rewriteKeysPackageImportLine(line: string): string {
  const match = /^(\s*)import\s+(type\s+)?\{([^}]+)\}\s+from\s+(["'])@diffgazer\/keys\4;?\s*$/.exec(line);
  if (!match) return line;

  const indent = match[1] ?? "";
  const typePrefix = match[2] ?? "";
  const quote = match[4] ?? "\"";
  const grouped = new Map<string, string[]>();
  const unknown: string[] = [];

  for (const rawSpecifier of (match[3] ?? "").split(",")) {
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

  if (unknown.length > 0) {
    throw new Error(
      `Unknown @diffgazer/keys import specifiers in public registry copy content: ${unknown.join(", ")}. ` +
      `Add them to KEYS_PACKAGE_IMPORT_TARGETS in transform-public-registry-keys-imports.ts.`,
    );
  }

  const rewritten = [...grouped.entries()].map(([target, specifiers]) =>
    indent + renderImport(specifiers, target, quote),
  );

  return rewritten.length > 0 ? rewritten.join("\n") : line;
}

function stripRelativeJsExtensions(content: string): string {
  return content.replace(
    /(\bfrom\s+|\bimport\s+|\bimport\(\s*|\brequire\(\s*)(["'])(\.{1,2}\/[^"']+)\.js\2/g,
    (_: string, prefix: string, quote: string, specifier: string) => `${prefix}${quote}${specifier}${quote}`,
  );
}

export function transformUiPublicRegistryKeysImportContent(content: string): string {
  const keysRewritten = content.split("\n").map(rewriteKeysPackageImportLine).join("\n");
  return stripRelativeJsExtensions(keysRewritten);
}

interface RegistryFileWithContent {
  content?: string;
}

interface PublicRegistryItemJson {
  files?: RegistryFileWithContent[];
}

export function transformUiPublicRegistryKeysImports(outputDir: string): void {
  for (const entry of readdirSync(outputDir)) {
    if (!entry.endsWith(".json") || entry === "registry.json") continue;

    const itemPath = join(outputDir, entry);
    const item = JSON.parse(readFileSync(itemPath, "utf-8")) as PublicRegistryItemJson;
    let changed = false;

    for (const file of item.files ?? []) {
      if (typeof file.content !== "string") continue;

      const nextContent = transformUiPublicRegistryKeysImportContent(file.content);
      if (nextContent === file.content) continue;

      file.content = nextContent;
      changed = true;
    }

    if (changed) {
      writeFileSync(itemPath, `${JSON.stringify(item, null, 2)}\n`);
    }
  }
}
