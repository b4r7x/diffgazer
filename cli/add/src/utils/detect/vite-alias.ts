import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  aliasPrefixFromKey,
  pickSourceAlias,
  type SourceAlias,
  sourceDirFromTarget,
} from "./source-alias.js";
import {
  arrayElementRanges,
  type ConfigToken,
  callArguments,
  findExpressionEnd,
  findMatchingToken,
  findTopLevelToken,
  findVariableInitializer,
  objectEntries,
  rangeMatches,
  TOKEN_PAIRS,
  type TokenRange,
  tokenizeViteConfig,
  unwrapParenthesizedRange,
} from "./vite-config-tokens.js";

interface ConfigImports {
  defineConfigs: Set<string>;
  fileUrlToPaths: Set<string>;
  importedBindings: Set<string>;
  pathObjects: Set<string>;
  pathResolvers: Set<string>;
  urlConstructors: Set<string>;
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

export function detectViteAlias(cwd: string): SourceAlias | null {
  for (const file of ["vite.config.ts", "vite.config.mts", "vite.config.js", "vite.config.mjs"]) {
    const configPath = resolve(cwd, file);
    if (!existsSync(configPath)) continue;

    const alias = pickSourceAlias(parseExportedViteAliases(readFileSync(configPath, "utf-8")));
    if (alias) return alias;
  }

  return null;
}
