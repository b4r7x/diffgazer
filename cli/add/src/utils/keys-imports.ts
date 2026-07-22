import { rewriteKeysPackageImportsInContent } from "@diffgazer/registry";
import { SOURCE_ALIASES } from "../context.js";
import { getKeysHookImportNames } from "./keys-copy-bundle.js";
import { escapeForRegex } from "./transform.js";

function renderImport(specifiers: string[], target: string, quote: string): string {
  const hooksBase = SOURCE_ALIASES.hooks.replace(/\/$/, "");
  return `import { ${specifiers.join(", ")} } from ${quote}${hooksBase}/${target}${quote};`;
}

export function rewriteKeysPackageImportsForCopy(content: string): string {
  return rewriteKeysPackageImportsInContent(content, {
    renderImport: (specifiers, target, quote, indent) =>
      indent + renderImport(specifiers, target, quote),
  });
}

// Both are derived from the copy bundle, which `@diffgazer/registry` loads once
// and treats as immutable for the process lifetime. They are memoized for the
// process and intentionally never invalidated: the alternation regex below is
// O(hooks) to build and the inputs cannot change between CLI commands in a
// single run. A long-lived process that hot-swaps the bundle is not a supported
// mode; if that ever changes, expose a reset alongside the bundle reload.
let _keysHookFiles: Set<string> | null = null;
let _reLocalHookImport: RegExp | null = null;

function getKeysHookFilesSet(): Set<string> {
  if (!_keysHookFiles) {
    _keysHookFiles = getKeysHookImportNames();
  }
  return _keysHookFiles;
}

function getLocalHookImportRegex(): RegExp {
  if (!_reLocalHookImport) {
    const hookNames = [...getKeysHookFilesSet()]
      .sort((a, b) => b.length - a.length)
      .map(escapeForRegex);
    const alternation = hookNames.join("|");
    _reLocalHookImport = new RegExp(
      `^\\s*import\\s+(?:type\\s+)?\\{([^}]+)\\}\\s+from\\s+(["'])@\\/hooks\\/(${alternation})\\2\\s*;?\\s*$`,
    );
  }
  return _reLocalHookImport;
}

interface ParsedKeysImport {
  lineIndex: number;
  quote: string;
  specifiers: string[];
  isTypeImport: boolean;
}

interface ParseKeysImportLineOptions {
  line: string;
  lineIndex: number;
  regex: RegExp;
  hookNames: Set<string>;
}

function parseKeysImportLine(options: ParseKeysImportLineOptions): ParsedKeysImport | null {
  const { line, lineIndex, regex, hookNames } = options;
  const m = regex.exec(line);
  if (!m) return null;

  const hookFile = m[3];
  if (!hookFile || !hookNames.has(hookFile)) return null;

  return {
    lineIndex,
    quote: m[2] ?? '"',
    specifiers: (m[1] ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    isTypeImport: /^\s*import\s+type\s/.test(line),
  };
}

function buildConsolidatedImport(
  parsed: ParsedKeysImport[],
): { consolidated: string; quote: string } | null {
  const valueSpecs: string[] = [];
  const typeSpecs: string[] = [];
  let quote = '"';

  for (const p of parsed) {
    quote = p.quote;
    const target = p.isTypeImport ? typeSpecs : valueSpecs;
    target.push(...p.specifiers);
  }

  const allSpecs = [...valueSpecs, ...typeSpecs.map((s) => `type ${s}`)];
  if (allSpecs.length === 0) return null;

  return {
    consolidated: `import { ${allSpecs.join(", ")} } from ${quote}@diffgazer/keys${quote};`,
    quote,
  };
}

function replaceMatchedLines(
  lines: string[],
  matchedIndices: Set<number>,
  replacement: string[],
): string[] {
  let inserted = false;
  const result: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!matchedIndices.has(i)) {
      const line = lines[i];
      if (line !== undefined) result.push(line);
      continue;
    }
    if (!inserted) {
      result.push(...replacement);
      inserted = true;
    }
  }
  return result;
}

export function rewriteLocalImportsForKeysPackage(content: string): string {
  const lines = content.split("\n");
  const hookNames = getKeysHookFilesSet();
  const regex = getLocalHookImportRegex();

  const parsed: ParsedKeysImport[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const result = parseKeysImportLine({ line, lineIndex: i, regex, hookNames });
    if (result) parsed.push(result);
  }

  if (parsed.length === 0) return content;

  const matchedIndices = new Set(parsed.map((p) => p.lineIndex));
  const built = buildConsolidatedImport(parsed);
  const replacement = built ? [built.consolidated] : [];

  return replaceMatchedLines(lines, matchedIndices, replacement).join("\n");
}
