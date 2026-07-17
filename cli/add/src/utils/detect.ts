import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  detectPackageManager,
  detectSourceDir,
  type PackageJson,
  type PackageManager,
  readPackageJson,
  readTsConfigPaths,
  warn,
} from "@diffgazer/registry/cli";

function detectTailwindVersion(pkg: PackageJson | null): string | null {
  if (!pkg) return null;
  const dependencyVersion = pkg.dependencies?.tailwindcss;
  if (typeof dependencyVersion === "string") return dependencyVersion;
  const devDependencyVersion = pkg.devDependencies?.tailwindcss;
  return typeof devDependencyVersion === "string" ? devDependencyVersion : null;
}

interface SourceAlias {
  importPrefix: string;
  sourceDir: string;
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/$/, "");
}

function sourceDirFromTarget(target: string): string | null {
  const normalized = normalizePath(target.replace(/\*$/, ""));
  if (!normalized || normalized === ".") return ".";
  if (normalized.includes("node_modules")) return null;
  return normalized === "src" || normalized === "app" ? normalized : null;
}

function aliasPrefixFromKey(key: string): string | null {
  if (key === "*" || key.length === 0) return null;
  return key.endsWith("/*") ? key.slice(0, -2) : key;
}

function pickSourceAlias(aliases: SourceAlias[]): SourceAlias | null {
  if (aliases.length === 0) return null;
  const [firstAlias] = aliases;
  return (
    aliases.find((alias) => alias.importPrefix === "@") ??
    aliases.find((alias) => alias.importPrefix === "~") ??
    firstAlias ??
    null
  );
}

type ConfigTokenKind = "identifier" | "string" | "punctuator" | "other";

interface ConfigToken {
  kind: ConfigTokenKind;
  value: string;
}

interface TokenRange {
  start: number;
  end: number;
}

interface ConfigImports {
  defineConfigs: Set<string>;
  fileUrlToPaths: Set<string>;
  importedBindings: Set<string>;
  pathObjects: Set<string>;
  pathResolvers: Set<string>;
  urlConstructors: Set<string>;
}

const IDENTIFIER_START_RE = /[A-Za-z_$]/;
const IDENTIFIER_PART_RE = /[A-Za-z0-9_$]/;
const REGEX_PREFIXES = new Set(["(", "[", "{", ",", ":", "=", "!", "?", ";", "=>"]);
const TOKEN_PAIRS: Readonly<Record<string, string>> = { "(": ")", "[": "]", "{": "}" };

function canStartRegex(previous: ConfigToken | undefined): boolean {
  if (!previous) return true;
  if (previous.kind === "punctuator") return REGEX_PREFIXES.has(previous.value);
  return previous.kind === "identifier" && ["case", "return", "throw"].includes(previous.value);
}

function tokenizeViteConfig(source: string): ConfigToken[] {
  const tokens: ConfigToken[] = [];
  let index = 0;

  while (index < source.length) {
    const character = source[index];
    const next = source[index + 1];

    if (character === undefined || /\s/.test(character)) {
      index += 1;
      continue;
    }

    if (character === "/" && next === "/") {
      index += 2;
      while (index < source.length && source[index] !== "\n") index += 1;
      continue;
    }

    if (character === "/" && next === "*") {
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) {
        index += 1;
      }
      index = Math.min(index + 2, source.length);
      continue;
    }

    if (character === '"' || character === "'") {
      const quote = character;
      let value = "";
      index += 1;
      while (index < source.length) {
        const current = source[index];
        if (current === undefined) break;
        if (current === "\\") {
          const escaped = source[index + 1];
          if (escaped !== undefined) value += escaped;
          index += 2;
          continue;
        }
        if (current === quote) {
          index += 1;
          break;
        }
        value += current;
        index += 1;
      }
      tokens.push({ kind: "string", value });
      continue;
    }

    if (character === "`") {
      index += 1;
      while (index < source.length) {
        if (source[index] === "\\") {
          index += 2;
          continue;
        }
        if (source[index] === "`") {
          index += 1;
          break;
        }
        index += 1;
      }
      tokens.push({ kind: "other", value: "template" });
      continue;
    }

    if (character === "/" && canStartRegex(tokens.at(-1))) {
      let inCharacterClass = false;
      index += 1;
      while (index < source.length) {
        const current = source[index];
        if (current === "\\") {
          index += 2;
          continue;
        }
        if (current === "[") inCharacterClass = true;
        if (current === "]") inCharacterClass = false;
        index += 1;
        if (current === "/" && !inCharacterClass) break;
      }
      while (index < source.length && /[A-Za-z]/.test(source[index] ?? "")) index += 1;
      tokens.push({ kind: "other", value: "regex" });
      continue;
    }

    if (IDENTIFIER_START_RE.test(character)) {
      const start = index;
      index += 1;
      while (index < source.length && IDENTIFIER_PART_RE.test(source[index] ?? "")) index += 1;
      tokens.push({ kind: "identifier", value: source.slice(start, index) });
      continue;
    }

    if (character === "=" && next === ">") {
      tokens.push({ kind: "punctuator", value: "=>" });
      index += 2;
      continue;
    }

    tokens.push({ kind: "punctuator", value: character });
    index += 1;
  }

  return tokens;
}

function addConfigImport(
  imports: ConfigImports,
  source: string,
  imported: string,
  local: string,
): void {
  if (source === "node:path" || source === "path") {
    if (imported === "default" || imported === "*") imports.pathObjects.add(local);
    if (imported === "resolve") imports.pathResolvers.add(local);
  }
  if ((source === "node:url" || source === "url") && imported === "fileURLToPath") {
    imports.fileUrlToPaths.add(local);
  }
  if ((source === "node:url" || source === "url") && imported === "URL") {
    imports.urlConstructors.add(local);
  }
  if (source === "vite" && imported === "defineConfig") imports.defineConfigs.add(local);
}

function configImports(tokens: ConfigToken[]): ConfigImports {
  const imports: ConfigImports = {
    defineConfigs: new Set(),
    fileUrlToPaths: new Set(),
    importedBindings: new Set(),
    pathObjects: new Set(),
    pathResolvers: new Set(),
    urlConstructors: new Set(),
  };

  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index]?.value !== "import") continue;
    const first = tokens[index + 1];
    if (first?.kind === "identifier" && tokens[index + 2]?.value === "from") {
      const source = tokens[index + 3];
      if (source?.kind === "string") {
        imports.importedBindings.add(first.value);
        addConfigImport(imports, source.value, "default", first.value);
      }
      continue;
    }
    if (
      first?.value === "*" &&
      tokens[index + 2]?.value === "as" &&
      tokens[index + 3]?.kind === "identifier" &&
      tokens[index + 4]?.value === "from" &&
      tokens[index + 5]?.kind === "string"
    ) {
      imports.importedBindings.add(tokens[index + 3]?.value ?? "");
      addConfigImport(imports, tokens[index + 5]?.value ?? "", "*", tokens[index + 3]?.value ?? "");
      continue;
    }
    if (first?.value !== "{") continue;
    const close = findMatchingToken(tokens, index + 1, "{", "}");
    const source = close === null ? undefined : tokens[close + 2];
    if (close === null || tokens[close + 1]?.value !== "from" || source?.kind !== "string")
      continue;

    let binding = index + 2;
    while (binding < close) {
      if (tokens[binding]?.value === ",") {
        binding += 1;
        continue;
      }
      const imported = tokens[binding];
      if (imported?.kind !== "identifier") break;
      const hasAlias = tokens[binding + 1]?.value === "as";
      const local = hasAlias ? tokens[binding + 2] : imported;
      if (local?.kind !== "identifier") break;
      imports.importedBindings.add(local.value);
      addConfigImport(imports, source.value, imported.value, local.value);
      binding += hasAlias ? 3 : 1;
    }
  }

  return imports;
}

function findMatchingToken(
  tokens: ConfigToken[],
  start: number,
  open: string,
  close: string,
): number | null {
  if (tokens[start]?.value !== open) return null;
  let depth = 0;
  for (let index = start; index < tokens.length; index += 1) {
    const value = tokens[index]?.value;
    if (value === open) depth += 1;
    if (value !== close) continue;
    depth -= 1;
    if (depth === 0) return index;
  }
  return null;
}

function findExpressionEnd(tokens: ConfigToken[], start: number, limit: number): number {
  const closingTokens: string[] = [];

  for (let index = start; index < limit; index += 1) {
    const value = tokens[index]?.value;
    if (value === undefined) return index;
    const close = TOKEN_PAIRS[value];
    if (close) {
      closingTokens.push(close);
      continue;
    }
    if (closingTokens.at(-1) === value) {
      closingTokens.pop();
      continue;
    }
    if (closingTokens.length === 0 && (value === "," || value === ";")) return index;
  }
  return limit;
}

function objectEntries(
  tokens: ConfigToken[],
  objectStart: number,
): Array<{ key: string; value: TokenRange }> | null {
  const objectEnd = findMatchingToken(tokens, objectStart, "{", "}");
  if (objectEnd === null) return null;
  const entries: Array<{ key: string; value: TokenRange }> = [];
  const keys = new Set<string>();
  let index = objectStart + 1;

  while (index < objectEnd) {
    if (tokens[index]?.value === ",") {
      index += 1;
      continue;
    }

    const key = tokens[index];
    const separator = tokens[index + 1]?.value;
    if ((key?.kind === "identifier" || key?.kind === "string") && separator === ":") {
      if (keys.has(key.value)) return null;
      const start = index + 2;
      const end = findExpressionEnd(tokens, start, objectEnd);
      if (start === end) return null;
      keys.add(key.value);
      entries.push({ key: key.value, value: { start, end } });
      index = end;
      continue;
    }

    if (key?.kind === "identifier" && (separator === "," || index + 1 === objectEnd)) {
      if (keys.has(key.value)) return null;
      keys.add(key.value);
      entries.push({ key: key.value, value: { start: index, end: index + 1 } });
      index += 1;
      continue;
    }

    return null;
  }

  return entries;
}

function findVariableInitializer(
  tokens: ConfigToken[],
  name: string,
  before: number,
  useAt: number,
): TokenRange | null {
  let found: TokenRange | null = null;
  const closingTokens: string[] = [];

  for (let index = 0; index + 3 < before; index += 1) {
    const value = tokens[index]?.value;
    if (closingTokens.at(-1) === value) {
      closingTokens.pop();
      continue;
    }
    const close = value ? TOKEN_PAIRS[value] : undefined;
    if (close) {
      closingTokens.push(close);
      continue;
    }
    if (closingTokens.length > 0) continue;
    if (tokens[index]?.value !== "const") continue;
    if (tokens[index + 1]?.value !== name || tokens[index + 2]?.value !== "=") continue;
    const start = index + 3;
    found = { start, end: findExpressionEnd(tokens, start, before) };
  }
  return found && hasNoBindingUse(tokens, name, found.end + 1, useAt) ? found : null;
}

function hasNoBindingUse(
  tokens: ConfigToken[],
  name: string,
  after: number,
  before: number,
): boolean {
  for (let index = after; index < before; index += 1) {
    if (tokens[index]?.value === "function") {
      let bodyStart = index + 1;
      while (bodyStart < before && tokens[bodyStart]?.value !== "{") bodyStart += 1;
      const bodyEnd = findMatchingToken(tokens, bodyStart, "{", "}");
      if (bodyEnd !== null) index = bodyEnd;
      continue;
    }
    if (tokens[index]?.value === "=>") {
      const bodyStart = index + 1;
      const opening = tokens[bodyStart]?.value;
      const closing = opening ? TOKEN_PAIRS[opening] : undefined;
      const bodyEnd =
        opening && closing ? findMatchingToken(tokens, bodyStart, opening, closing) : null;
      if (bodyEnd !== null) index = bodyEnd;
      continue;
    }
    if (tokens[index]?.kind !== "identifier" || tokens[index]?.value !== name) continue;
    if (tokens[index + 1]?.value === ":") continue;
    return false;
  }
  return true;
}

function findTopLevelToken(
  tokens: ConfigToken[],
  range: TokenRange,
  expected: string,
): number | null {
  const closingTokens: string[] = [];
  for (let index = range.start; index < range.end; index += 1) {
    const value = tokens[index]?.value;
    if (value === expected && closingTokens.length === 0) return index;
    const close = value ? TOKEN_PAIRS[value] : undefined;
    if (close) closingTokens.push(close);
    else if (closingTokens.at(-1) === value) closingTokens.pop();
  }
  return null;
}

function returnedObjectExpression(
  tokens: ConfigToken[],
  blockStart: number,
  before: number,
  seen: Set<string>,
  imports: ConfigImports,
): number | null {
  const blockEnd = findMatchingToken(tokens, blockStart, "{", "}");
  if (blockEnd === null) return null;
  const returns: TokenRange[] = [];

  for (let index = blockStart + 1; index < blockEnd; index += 1) {
    const value = tokens[index]?.value;
    if (["if", "switch", "try", "catch", "for", "while", "do"].includes(value ?? "")) {
      return null;
    }
    if (value === "function") {
      let bodyStart = index + 1;
      while (bodyStart < blockEnd && tokens[bodyStart]?.value !== "{") bodyStart += 1;
      const bodyEnd = findMatchingToken(tokens, bodyStart, "{", "}");
      if (bodyEnd === null) return null;
      index = bodyEnd;
      continue;
    }
    if (value === "=>") {
      const bodyStart = index + 1;
      const opening = tokens[bodyStart]?.value;
      const closing = opening ? TOKEN_PAIRS[opening] : undefined;
      if (opening && closing) {
        const bodyEnd = findMatchingToken(tokens, bodyStart, opening, closing);
        if (bodyEnd === null) return null;
        index = bodyEnd;
      }
      continue;
    }
    if (value === "return") {
      const start = index + 1;
      returns.push({ start, end: findExpressionEnd(tokens, start, blockEnd) });
      index = returns.at(-1)?.end ?? index;
      continue;
    }
    if (value === "(" || value === "[" || value === "{") {
      const close = TOKEN_PAIRS[value];
      if (!close) continue;
      const nestedEnd = findMatchingToken(tokens, index, value, close);
      if (nestedEnd === null) return null;
      if (
        value === "{" &&
        tokens.slice(index + 1, nestedEnd).some((token) => token.value === "return")
      ) {
        return null;
      }
      index = nestedEnd;
    }
  }

  if (returns.length !== 1) return null;
  const [returned] = returns;
  return returned ? unwrapObjectExpression(tokens, returned, before, imports, seen) : null;
}

function unwrapObjectExpression(
  tokens: ConfigToken[],
  range: TokenRange,
  before: number,
  imports: ConfigImports,
  seen = new Set<string>(),
): number | null {
  const { start, end } = unwrapParenthesizedRange(tokens, range);

  const arrow = findTopLevelToken(tokens, { start, end }, "=>");
  if (arrow !== null) {
    const body = unwrapParenthesizedRange(tokens, { start: arrow + 1, end });
    if (tokens[body.start]?.value === "{") {
      return returnedObjectExpression(tokens, body.start, before, seen, imports);
    }
    return unwrapObjectExpression(tokens, body, before, imports, seen);
  }

  if (tokens[start]?.value === "{") {
    return findMatchingToken(tokens, start, "{", "}") === end - 1 ? start : null;
  }

  const identifier = tokens[start];
  if (identifier?.kind !== "identifier") return null;
  if (tokens[start + 1]?.value === "(") {
    if (!imports.defineConfigs.has(identifier.value)) return null;
    const argumentsList = callArguments(tokens, start + 1, end);
    const [config] = argumentsList ?? [];
    if (argumentsList?.length !== 1 || !config) return null;
    return unwrapObjectExpression(tokens, config, before, imports, seen);
  }

  if (end !== start + 1) return null;
  if (seen.has(identifier.value)) return null;
  seen.add(identifier.value);
  const initializer = findVariableInitializer(tokens, identifier.value, before, start);
  if (!initializer) return null;
  return unwrapObjectExpression(tokens, initializer, before, imports, seen);
}

function exportedConfigObject(
  tokens: ConfigToken[],
  imports: ConfigImports,
): { objectStart: number; exportStart: number } | null {
  for (let index = 0; index + 2 < tokens.length; index += 1) {
    if (tokens[index]?.value !== "export" || tokens[index + 1]?.value !== "default") continue;
    const range = { start: index + 2, end: findExpressionEnd(tokens, index + 2, tokens.length) };
    const objectStart = unwrapObjectExpression(tokens, range, index, imports);
    return objectStart === null ? null : { objectStart, exportStart: index };
  }
  return null;
}

function unwrapParenthesizedRange(tokens: ConfigToken[], range: TokenRange): TokenRange {
  let { start, end } = range;
  while (tokens[start]?.value === "(" && findMatchingToken(tokens, start, "(", ")") === end - 1) {
    start += 1;
    end -= 1;
  }
  return { start, end };
}

function rangeMatches(tokens: ConfigToken[], range: TokenRange, values: string[]): boolean {
  if (range.end - range.start !== values.length) return false;
  return values.every((value, index) => tokens[range.start + index]?.value === value);
}

function callArguments(
  tokens: ConfigToken[],
  openParenthesis: number,
  expressionEnd: number,
): TokenRange[] | null {
  const closeParenthesis = findMatchingToken(tokens, openParenthesis, "(", ")");
  if (closeParenthesis === null || closeParenthesis !== expressionEnd - 1) return null;
  if (closeParenthesis === openParenthesis + 1) return [];

  const argumentsList: TokenRange[] = [];
  let start = openParenthesis + 1;
  while (start < closeParenthesis) {
    const end = findExpressionEnd(tokens, start, closeParenthesis);
    if (end === start) return null;
    argumentsList.push({ start, end });
    if (end === closeParenthesis) return argumentsList;
    start = end + 1;
    if (start === closeParenthesis) return null;
  }
  return null;
}

function singleStringValue(tokens: ConfigToken[], range: TokenRange): string | null {
  const expression = unwrapParenthesizedRange(tokens, range);
  const token = tokens[expression.start];
  if (expression.end !== expression.start + 1 || token?.kind !== "string") return null;
  return token.value;
}

function stringTarget(tokens: ConfigToken[], range: TokenRange): string | null {
  const value = singleStringValue(tokens, range);
  return value && sourceDirFromTarget(value) ? value : null;
}

function hasTopLevelDeclaration(tokens: ConfigToken[], name: string): boolean {
  const closingTokens: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const value = tokens[index]?.value;
    if (closingTokens.at(-1) === value) {
      closingTokens.pop();
      continue;
    }
    const close = value ? TOKEN_PAIRS[value] : undefined;
    if (close) {
      closingTokens.push(close);
      continue;
    }
    if (
      closingTokens.length === 0 &&
      ["class", "const", "function", "let", "var"].includes(value ?? "") &&
      tokens[index + 1]?.value === name
    ) {
      return true;
    }
  }
  return false;
}

function isProjectDirectoryExpression(
  tokens: ConfigToken[],
  range: TokenRange,
  imports: ConfigImports,
): boolean {
  const expression = unwrapParenthesizedRange(tokens, range);
  return (
    (rangeMatches(tokens, expression, ["__dirname"]) &&
      !imports.importedBindings.has("__dirname") &&
      !hasTopLevelDeclaration(tokens, "__dirname")) ||
    rangeMatches(tokens, expression, ["import", ".", "meta", ".", "dirname"])
  );
}

function isInsideFunctionBody(tokens: ConfigToken[], target: number): boolean {
  for (let index = 0; index < target; index += 1) {
    if (tokens[index]?.value === "=>") {
      const bodyStart = index + 1;
      const opening = tokens[bodyStart]?.value;
      const closing = opening ? TOKEN_PAIRS[opening] : undefined;
      if (
        opening &&
        closing &&
        (findMatchingToken(tokens, bodyStart, opening, closing) ?? -1) >= target
      ) {
        return true;
      }
    }
    if (tokens[index]?.value !== "function") continue;
    let parametersStart = index + 1;
    while (parametersStart < target && tokens[parametersStart]?.value !== "(") {
      parametersStart += 1;
    }
    const parametersEnd = findMatchingToken(tokens, parametersStart, "(", ")");
    const bodyStart = parametersEnd === null ? -1 : parametersEnd + 1;
    if (
      tokens[bodyStart]?.value === "{" &&
      (findMatchingToken(tokens, bodyStart, "{", "}") ?? -1) >= target
    ) {
      return true;
    }
  }
  return false;
}

function targetFromResolveCall(
  tokens: ConfigToken[],
  range: TokenRange,
  imports: ConfigImports,
): string | null {
  const expression = unwrapParenthesizedRange(tokens, range);
  if (isInsideFunctionBody(tokens, expression.start)) return null;
  let openParenthesis: number | null = null;
  if (
    tokens[expression.start]?.kind === "identifier" &&
    imports.pathResolvers.has(tokens[expression.start]?.value ?? "") &&
    tokens[expression.start + 1]?.value === "("
  ) {
    openParenthesis = expression.start + 1;
  } else if (
    tokens[expression.start]?.kind === "identifier" &&
    imports.pathObjects.has(tokens[expression.start]?.value ?? "") &&
    tokens[expression.start + 1]?.value === "." &&
    tokens[expression.start + 2]?.value === "resolve" &&
    tokens[expression.start + 3]?.value === "("
  ) {
    openParenthesis = expression.start + 3;
  }
  if (openParenthesis === null) return null;

  const argumentsList = callArguments(tokens, openParenthesis, expression.end);
  if (argumentsList?.length !== 2) return null;
  const [base, target] = argumentsList;
  if (!base || !target || !isProjectDirectoryExpression(tokens, base, imports)) return null;
  return stringTarget(tokens, target);
}

function targetFromNewUrl(
  tokens: ConfigToken[],
  range: TokenRange,
  requiresPathname: boolean,
  imports: ConfigImports,
): string | null {
  const expression = unwrapParenthesizedRange(tokens, range);
  if (isInsideFunctionBody(tokens, expression.start)) return null;
  const urlConstructor = tokens[expression.start + 1];
  const hasTrustedImport =
    urlConstructor?.kind === "identifier" && imports.urlConstructors.has(urlConstructor.value);
  const hasUnshadowedGlobal =
    urlConstructor?.value === "URL" &&
    !imports.importedBindings.has("URL") &&
    !hasTopLevelDeclaration(tokens, "URL");
  if (
    tokens[expression.start]?.value !== "new" ||
    (!hasTrustedImport && !hasUnshadowedGlobal) ||
    tokens[expression.start + 2]?.value !== "("
  ) {
    return null;
  }

  const callEnd = findMatchingToken(tokens, expression.start + 2, "(", ")");
  if (callEnd === null) return null;
  const expectedEnd = requiresPathname ? callEnd + 3 : callEnd + 1;
  if (expression.end !== expectedEnd) return null;
  if (
    requiresPathname &&
    (tokens[callEnd + 1]?.value !== "." || tokens[callEnd + 2]?.value !== "pathname")
  ) {
    return null;
  }

  const argumentsList = callArguments(tokens, expression.start + 2, callEnd + 1);
  if (argumentsList?.length !== 2) return null;
  const [target, base] = argumentsList;
  if (!target || !base || !rangeMatches(tokens, base, ["import", ".", "meta", ".", "url"])) {
    return null;
  }
  return stringTarget(tokens, target);
}

function targetFromFileUrlCall(
  tokens: ConfigToken[],
  range: TokenRange,
  imports: ConfigImports,
): string | null {
  const expression = unwrapParenthesizedRange(tokens, range);
  if (
    tokens[expression.start]?.kind !== "identifier" ||
    !imports.fileUrlToPaths.has(tokens[expression.start]?.value ?? "") ||
    tokens[expression.start + 1]?.value !== "("
  ) {
    return null;
  }
  const argumentsList = callArguments(tokens, expression.start + 1, expression.end);
  const [url] = argumentsList ?? [];
  return argumentsList?.length === 1 && url ? targetFromNewUrl(tokens, url, false, imports) : null;
}

function targetFromExpression(
  tokens: ConfigToken[],
  range: TokenRange,
  imports: ConfigImports,
): string | null {
  return (
    stringTarget(tokens, range) ??
    targetFromResolveCall(tokens, range, imports) ??
    targetFromNewUrl(tokens, range, true, imports) ??
    targetFromFileUrlCall(tokens, range, imports)
  );
}

function sourceAliasesFromObject(
  tokens: ConfigToken[],
  objectStart: number,
  imports: ConfigImports,
): SourceAlias[] {
  const aliases: SourceAlias[] = [];
  const entries = objectEntries(tokens, objectStart);
  if (!entries) return aliases;
  for (const entry of entries) {
    const importPrefix = aliasPrefixFromKey(entry.key);
    const target = targetFromExpression(tokens, entry.value, imports);
    const sourceDir = target ? sourceDirFromTarget(target) : null;
    if (importPrefix && sourceDir) aliases.push({ importPrefix, sourceDir });
  }
  return aliases;
}

function arrayElementRanges(tokens: ConfigToken[], arrayStart: number): TokenRange[] | null {
  const arrayEnd = findMatchingToken(tokens, arrayStart, "[", "]");
  if (arrayEnd === null) return null;
  const elements: TokenRange[] = [];
  let index = arrayStart + 1;

  while (index < arrayEnd) {
    if (tokens[index]?.value === ",") {
      index += 1;
      continue;
    }
    const end = findExpressionEnd(tokens, index, arrayEnd);
    if (end === index || (end < arrayEnd && tokens[end]?.value !== ",")) return null;
    elements.push({ start: index, end });
    index = end + 1;
  }

  return elements;
}

function sourceAliasesFromArray(
  tokens: ConfigToken[],
  arrayStart: number,
  imports: ConfigImports,
): SourceAlias[] {
  const aliases: SourceAlias[] = [];
  const elements = arrayElementRanges(tokens, arrayStart);
  if (!elements) return aliases;

  for (const range of elements) {
    const element = unwrapParenthesizedRange(tokens, range);
    if (
      tokens[element.start]?.value !== "{" ||
      findMatchingToken(tokens, element.start, "{", "}") !== element.end - 1
    ) {
      return [];
    }
    const entries = objectEntries(tokens, element.start);
    if (!entries || entries.length !== 2) return [];
    const find = entries.find((entry) => entry.key === "find");
    const replacement = entries.find((entry) => entry.key === "replacement");
    const findValue = find ? singleStringValue(tokens, find.value) : null;
    const importPrefix = findValue ? aliasPrefixFromKey(findValue) : null;
    const target = replacement ? targetFromExpression(tokens, replacement.value, imports) : null;
    const sourceDir = target ? sourceDirFromTarget(target) : null;
    if (!importPrefix || !sourceDir) return [];
    aliases.push({ importPrefix, sourceDir });
  }

  return aliases;
}

type AliasCollection = { kind: "array" | "object"; start: number };

function unwrapAliasCollection(
  tokens: ConfigToken[],
  range: TokenRange,
  before: number,
  seen = new Set<string>(),
): AliasCollection | null {
  const { start, end } = unwrapParenthesizedRange(tokens, range);

  const opening = tokens[start]?.value;
  if (
    (opening === "{" || opening === "[") &&
    findMatchingToken(tokens, start, opening, TOKEN_PAIRS[opening] ?? "") === end - 1
  ) {
    return { kind: opening === "{" ? "object" : "array", start };
  }

  const identifier = tokens[start];
  if (identifier?.kind !== "identifier" || end !== start + 1 || seen.has(identifier.value)) {
    return null;
  }
  seen.add(identifier.value);
  const initializer = findVariableInitializer(tokens, identifier.value, before, start);
  return initializer ? unwrapAliasCollection(tokens, initializer, before, seen) : null;
}

function parseExportedViteAliases(content: string): SourceAlias[] {
  const tokens = tokenizeViteConfig(content);
  const imports = configImports(tokens);
  const exported = exportedConfigObject(tokens, imports);
  if (!exported) return [];
  const configEntries = objectEntries(tokens, exported.objectStart);
  const resolveEntry = configEntries?.find((entry) => entry.key === "resolve");
  if (!resolveEntry) return [];
  const resolveObject = unwrapObjectExpression(
    tokens,
    resolveEntry.value,
    exported.exportStart,
    imports,
  );
  if (resolveObject === null) return [];
  const resolveEntries = objectEntries(tokens, resolveObject);
  const aliasEntry = resolveEntries?.find((entry) => entry.key === "alias");
  if (!aliasEntry) return [];

  const aliases = unwrapAliasCollection(tokens, aliasEntry.value, exported.exportStart);
  if (!aliases) return [];
  return aliases.kind === "object"
    ? sourceAliasesFromObject(tokens, aliases.start, imports)
    : sourceAliasesFromArray(tokens, aliases.start, imports);
}

function detectTypeScriptAlias(cwd: string): SourceAlias | null {
  const paths = readTsConfigPaths(cwd);
  if (!paths) return null;

  const aliases: SourceAlias[] = [];
  for (const [key, targets] of Object.entries(paths)) {
    const importPrefix = aliasPrefixFromKey(key);
    if (!importPrefix || !Array.isArray(targets)) continue;

    for (const target of targets) {
      if (typeof target !== "string") continue;
      const sourceDir = sourceDirFromTarget(target);
      if (sourceDir) aliases.push({ importPrefix, sourceDir });
    }
  }

  return pickSourceAlias(aliases);
}

function detectViteAlias(cwd: string): SourceAlias | null {
  for (const file of ["vite.config.ts", "vite.config.mts", "vite.config.js", "vite.config.mjs"]) {
    const configPath = resolve(cwd, file);
    if (!existsSync(configPath)) continue;

    const alias = pickSourceAlias(parseExportedViteAliases(readFileSync(configPath, "utf-8")));
    if (alias) return alias;
  }

  return null;
}

function detectRsc(cwd: string, pkg: PackageJson | null): boolean {
  if (!pkg) return false;
  const hasAppDir = existsSync(resolve(cwd, "app")) || existsSync(resolve(cwd, "src/app"));
  if (!hasAppDir) return false;
  const dependencyVersion = pkg.dependencies?.next;
  const devDependencyVersion = pkg.devDependencies?.next;
  let nextVersion: string | null = null;
  if (typeof dependencyVersion === "string") nextVersion = dependencyVersion;
  else if (typeof devDependencyVersion === "string") nextVersion = devDependencyVersion;
  if (nextVersion === null) return false;
  const match = nextVersion.match(/(\d+)\.(\d+)/);
  if (!match) {
    warn(`Could not parse Next.js version "${nextVersion}" for RSC detection`);
    return false;
  }
  const [, major, minor] = match;
  if (!major || !minor) return false;

  const maj = parseInt(major, 10);
  const min = parseInt(minor, 10);
  return maj > 13 || (maj === 13 && min >= 4);
}

/** CLI project detection info. @see @diffgazer/core/schemas/config (ProjectInfoSchema) for the server-side project info with trust config. */
export interface ProjectInfo {
  packageManager: PackageManager;
  sourceDir: string;
  tailwindVersion: string | null;
  hasPathAlias: boolean;
  importAliasPrefix: string;
  rsc: boolean;
}

export function detectProject(cwd: string): ProjectInfo {
  const pkg = readPackageJson(cwd);
  const sourceAlias = detectTypeScriptAlias(cwd) ?? detectViteAlias(cwd);
  const packageManagerPackageJson = pkg
    ? {
        ...pkg,
        packageManager: typeof pkg.packageManager === "string" ? pkg.packageManager : undefined,
      }
    : null;
  return {
    packageManager: detectPackageManager(cwd, packageManagerPackageJson),
    sourceDir: sourceAlias?.sourceDir ?? detectSourceDir(cwd),
    tailwindVersion: detectTailwindVersion(pkg),
    hasPathAlias: sourceAlias !== null,
    importAliasPrefix: sourceAlias?.importPrefix ?? "@",
    rsc: detectRsc(cwd, pkg),
  };
}
