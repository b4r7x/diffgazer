import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import ts from "typescript";

export const root = resolve(import.meta.dirname, "../..");

type SourceDeclaration = ts.InterfaceDeclaration | ts.TypeAliasDeclaration;

type SourceTypeIndex = {
  declarationsByFile: Map<string, Map<string, SourceDeclaration>>;
  declarationsByName: Map<string, SourceDeclaration[]>;
  sourcesByFile: Map<string, ts.SourceFile>;
};

export type SourceTypeReference = {
  sourcePath: string;
  typeName: string;
};

const SOURCE_EXTENSIONS = [".ts", ".tsx"] as const;
const sourceTypeIndex = createSourceTypeIndex();
let sourceTypeProgram: ts.Program | undefined;

// Binding the whole registry a second time costs over a second, and only
// sourceTypeHasMember needs it, so the program is built on first use.
function getSourceTypeProgram(): ts.Program {
  sourceTypeProgram ??= ts.createProgram([...sourceTypeIndex.sourcesByFile.keys()], {
    allowJs: false,
    jsx: ts.JsxEmit.ReactJSX,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    baseUrl: resolve(root),
    paths: {
      "@/lib/*": ["registry/lib/*"],
      "@/hooks/*": ["registry/hooks/*"],
      "@/components/ui/*": ["registry/ui/*"],
    },
    skipLibCheck: true,
    target: ts.ScriptTarget.Latest,
  });
  return sourceTypeProgram;
}

function getSourceTypeChecker(): ts.TypeChecker {
  return getSourceTypeProgram().getTypeChecker();
}

export function findSourceType(typeName: string): SourceTypeReference | undefined {
  const declarations = sourceTypeIndex.declarationsByName.get(typeName) ?? [];
  const declaration = declarations[0];
  if (!declaration) return undefined;
  return { sourcePath: declaration.getSourceFile().fileName, typeName };
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = resolve(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(filePath);
    if (!SOURCE_EXTENSIONS.some((extension) => entry.name.endsWith(extension))) return [];
    if (entry.name.endsWith(".test.ts") || entry.name.endsWith(".test.tsx")) return [];
    return [filePath];
  });
}

function createSourceTypeIndex(): SourceTypeIndex {
  const index: SourceTypeIndex = {
    declarationsByFile: new Map(),
    declarationsByName: new Map(),
    sourcesByFile: new Map(),
  };

  for (const fileName of [
    ...sourceFiles(resolve(root, "registry/ui")),
    ...sourceFiles(resolve(root, "registry/hooks")),
    ...sourceFiles(resolve(root, "registry/lib")),
  ]) {
    const source = readSourceFile(fileName);
    const declarations = new Map<string, SourceDeclaration>();
    source.forEachChild((node) => {
      if (!ts.isInterfaceDeclaration(node) && !ts.isTypeAliasDeclaration(node)) return;
      declarations.set(node.name.text, node);
      const candidates = index.declarationsByName.get(node.name.text) ?? [];
      candidates.push(node);
      index.declarationsByName.set(node.name.text, candidates);
    });
    index.declarationsByFile.set(fileName, declarations);
    index.sourcesByFile.set(fileName, source);
  }

  return index;
}

function readSourceFile(fileName: string): ts.SourceFile {
  const source = readFileSync(fileName, "utf8");
  return ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

export function readSource(relativePath: string): ts.SourceFile {
  const fileName = resolve(root, relativePath);
  return sourceTypeIndex.sourcesByFile.get(fileName) ?? readSourceFile(fileName);
}

export function jsDocDescription(node: ts.Node): string {
  const doc = ts
    .getJSDocCommentsAndTags(node)
    .find((entry): entry is ts.JSDoc => entry.kind === ts.SyntaxKind.JSDocComment);

  if (!doc) return "";
  if (typeof doc.comment === "string") return doc.comment.trim();
  if (Array.isArray(doc.comment)) {
    return doc.comment
      .map((part) => part.text)
      .join("")
      .trim();
  }
  return "";
}

export function getInterfaceMemberDocs(
  source: ts.SourceFile,
  interfaceName: string,
): Map<string, string> {
  const docs = new Map<string, string>();

  const declaration = findDeclaration(source, interfaceName);
  if (declaration) collectDeclarationDocs(declaration, docs, new Set());

  return docs;
}

/**
 * Returns whether a mapped source declaration has a meaningful object/type shape. A declaration
 * can legitimately have no local JSDoc when its props come from a native or imported base type.
 */
export function sourceTypeHasShape(source: ts.SourceFile, typeName: string): boolean {
  const declaration = findDeclaration(source, typeName);
  return declaration ? declarationHasShape(declaration, new Set()) : false;
}

/**
 * `type.member` pairs whose existence was answered by the JSDoc fallback below
 * rather than the checker. A pair here means the sync still passes but no longer
 * proves the member is on the type, so callers assert this stays empty.
 */
export const sourceTypeMemberFallbacks = new Set<string>();

export function sourceTypeHasMember(
  source: ts.SourceFile,
  typeName: string,
  memberName: string,
): boolean {
  const declaration = findDeclaration(source, typeName);
  if (!declaration) return false;
  const programSource = getSourceTypeProgram().getSourceFile(declaration.getSourceFile().fileName);
  if (!programSource) return false;
  let programDeclaration: SourceDeclaration | undefined;
  programSource.forEachChild((node) => {
    if (
      (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) &&
      node.name.text === declaration.name.text
    ) {
      programDeclaration = node;
    }
  });
  if (!programDeclaration) return false;
  const checker = getSourceTypeChecker();
  const symbol = checker.getSymbolAtLocation(programDeclaration.name);
  if (!symbol) return false;
  if (typeHasMember(checker.getDeclaredTypeOfSymbol(symbol), memberName, new Set())) {
    return true;
  }
  // A source alias can resolve through a path-mapped barrel that the standalone checker cannot
  // bind without the package's full project graph. The same resolved AST walk used for JSDoc
  // collection still proves a documented member exists; keep the fallback member-specific.
  sourceTypeMemberFallbacks.add(`${typeName}.${memberName}`);
  return getInterfaceMemberDocs(source, typeName).has(memberName);
}

function typeHasMember(type: ts.Type, memberName: string, seen: Set<ts.Type>): boolean {
  if (seen.has(type)) return false;
  seen.add(type);
  if (
    getSourceTypeChecker()
      .getPropertiesOfType(type)
      .some((property) => property.name === memberName)
  ) {
    return true;
  }
  if (type.isUnionOrIntersection()) {
    return type.types.some((part) => typeHasMember(part, memberName, seen));
  }
  return false;
}

function declarationHasShape(
  declaration: SourceDeclaration,
  seenDeclarations: Set<string>,
): boolean {
  const source = declaration.getSourceFile();
  const key = `${source.fileName}:${declaration.name.text}`;
  if (seenDeclarations.has(key)) return false;
  seenDeclarations.add(key);

  if (ts.isInterfaceDeclaration(declaration)) {
    return (
      declaration.members.length > 0 ||
      (declaration.heritageClauses ?? []).some((heritage) =>
        heritage.types.some((type) => typeNodeHasShape(source, type, seenDeclarations)),
      )
    );
  }

  return typeNodeHasShape(source, declaration.type, seenDeclarations);
}

function typeNodeHasShape(
  source: ts.SourceFile,
  node: ts.TypeNode,
  seenDeclarations: Set<string>,
): boolean {
  if (ts.isParenthesizedTypeNode(node))
    return typeNodeHasShape(source, node.type, seenDeclarations);
  if (ts.isTypeLiteralNode(node)) return node.members.length > 0;
  if (ts.isIntersectionTypeNode(node) || ts.isUnionTypeNode(node)) {
    return node.types.some((type) => typeNodeHasShape(source, type, seenDeclarations));
  }
  if (ts.isTypeReferenceNode(node)) {
    const name = typeReferenceName(node.typeName);
    const declaration = findDeclaration(source, name);
    // An unresolved reference is a library/native contract (for example React's
    // ComponentProps<"div">), not an empty declaration.
    return declaration ? declarationHasShape(declaration, seenDeclarations) : true;
  }
  if (
    node.kind === ts.SyntaxKind.NeverKeyword ||
    node.kind === ts.SyntaxKind.UnknownKeyword ||
    node.kind === ts.SyntaxKind.UndefinedKeyword ||
    node.kind === ts.SyntaxKind.NullKeyword
  ) {
    return false;
  }
  return true;
}

export function getInterfaceMember(
  source: ts.SourceFile,
  interfaceName: string,
  memberName: string,
): ts.PropertySignature | ts.MethodSignature | undefined {
  let match: ts.PropertySignature | ts.MethodSignature | undefined;

  source.forEachChild((node) => {
    if (!ts.isInterfaceDeclaration(node) || node.name.text !== interfaceName) return;
    match = node.members.find(
      (member): member is ts.PropertySignature | ts.MethodSignature =>
        (ts.isPropertySignature(member) || ts.isMethodSignature(member)) &&
        normalizeMemberName(member.name.getText(source)) === memberName,
    );
  });

  return match;
}

function normalizeMemberName(name: string): string {
  return name.replace(/^["']|["']$/g, "");
}

function collectMemberDocs(
  source: ts.SourceFile,
  members: ts.NodeArray<ts.TypeElement>,
  docs: Map<string, string>,
): void {
  for (const member of members) {
    if (!ts.isPropertySignature(member) && !ts.isMethodSignature(member)) continue;
    const name = normalizeMemberName(member.name.getText(source));
    const description = jsDocDescription(member);
    // A union branch may repeat a member without its JSDoc (`value?: never`);
    // the branch that documents it owns the description.
    if (docs.get(name) && (!description || /mutually exclusive/i.test(description))) continue;
    docs.set(name, description);
  }
}

function collectTypeMemberDocs(
  source: ts.SourceFile,
  node: ts.TypeNode,
  docs: Map<string, string>,
  seenDeclarations: Set<string>,
): void {
  if (ts.isTypeLiteralNode(node)) {
    collectMemberDocs(source, node.members, docs);
    return;
  }

  if (ts.isParenthesizedTypeNode(node)) {
    collectTypeMemberDocs(source, node.type, docs, seenDeclarations);
    return;
  }

  if (ts.isIntersectionTypeNode(node) || ts.isUnionTypeNode(node)) {
    for (const type of node.types) collectTypeMemberDocs(source, type, docs, seenDeclarations);
    return;
  }

  if (ts.isTypeReferenceNode(node)) {
    const name = typeReferenceName(node.typeName);
    if (name === "Omit" || name === "Pick" || name === "Partial" || name === "Required") {
      const base = node.typeArguments?.[0];
      if (!base) return;
      collectUtilityMemberDocs(
        source,
        name,
        base,
        node.typeArguments?.slice(1),
        docs,
        seenDeclarations,
      );
      return;
    }

    const declaration = findDeclaration(source, name);
    if (declaration) collectDeclarationDocs(declaration, docs, seenDeclarations);
  }
}

function collectDeclarationDocs(
  declaration: SourceDeclaration,
  docs: Map<string, string>,
  seenDeclarations: Set<string>,
): void {
  const source = declaration.getSourceFile();
  const key = `${source.fileName}:${declaration.name.text}`;
  if (seenDeclarations.has(key)) return;
  seenDeclarations.add(key);

  if (ts.isInterfaceDeclaration(declaration)) {
    for (const heritage of declaration.heritageClauses ?? []) {
      for (const type of heritage.types)
        collectHeritageMemberDocs(source, type, docs, seenDeclarations);
    }
    collectMemberDocs(source, declaration.members, docs);
    return;
  }

  collectTypeMemberDocs(source, declaration.type, docs, seenDeclarations);
}

function collectHeritageMemberDocs(
  source: ts.SourceFile,
  heritage: ts.ExpressionWithTypeArguments,
  docs: Map<string, string>,
  seenDeclarations: Set<string>,
): void {
  const name = expressionName(heritage.expression);
  if (!name) return;

  if (name === "Omit" || name === "Pick" || name === "Partial" || name === "Required") {
    const base = heritage.typeArguments?.[0];
    if (!base) return;
    collectUtilityMemberDocs(
      source,
      name,
      base,
      heritage.typeArguments?.slice(1),
      docs,
      seenDeclarations,
    );
    return;
  }

  const declaration = findDeclaration(source, name);
  if (declaration) collectDeclarationDocs(declaration, docs, seenDeclarations);
}

function collectUtilityMemberDocs(
  source: ts.SourceFile,
  utility: string,
  base: ts.TypeNode,
  keyArguments: readonly ts.TypeNode[] | undefined,
  docs: Map<string, string>,
  seenDeclarations: Set<string>,
): void {
  const inherited = new Map<string, string>();
  collectTypeMemberDocs(source, base, inherited, seenDeclarations);
  const keys = new Set(
    (keyArguments ?? []).flatMap((argument) => literalTypeNames(source, argument)),
  );
  for (const [member, description] of inherited) {
    if (utility === "Omit" && keys.has(member)) continue;
    if (utility === "Pick" && !keys.has(member)) continue;
    docs.set(member, description);
  }
}

function literalTypeNames(source: ts.SourceFile, node: ts.TypeNode): string[] {
  if (ts.isLiteralTypeNode(node)) {
    return [node.literal.getText(source).replace(/^['"]|['"]$/g, "")];
  }
  if (ts.isUnionTypeNode(node)) {
    return node.types.flatMap((type) => literalTypeNames(source, type));
  }
  return [];
}

function expressionName(expression: ts.Expression): string | undefined {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  return undefined;
}

function typeReferenceName(name: ts.EntityName): string {
  return ts.isIdentifier(name) ? name.text : name.right.text;
}

function findDeclaration(source: ts.SourceFile, name: string): SourceDeclaration | undefined {
  const local = sourceTypeIndex.declarationsByFile.get(source.fileName)?.get(name);
  if (local) return local;

  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.importClause) continue;
    const bindings = statement.importClause.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    const imported = bindings.elements.find((element) => element.name.text === name);
    if (!imported) continue;
    const module = resolveImportedSource(
      source,
      statement.moduleSpecifier.getText(source).replace(/^['"]|['"]$/g, ""),
    );
    if (!module) continue;
    return findExportedDeclaration(module, imported.propertyName?.getText(source) ?? name);
  }

  const candidates = sourceTypeIndex.declarationsByName.get(name) ?? [];
  return candidates.length === 1 ? candidates[0] : undefined;
}

function findExportedDeclaration(
  source: ts.SourceFile,
  name: string,
): SourceDeclaration | undefined {
  const direct = sourceTypeIndex.declarationsByFile.get(source.fileName)?.get(name);
  if (direct) return direct;

  for (const statement of source.statements) {
    if (!ts.isExportDeclaration(statement) || !statement.exportClause) continue;
    if (!ts.isNamedExports(statement.exportClause)) continue;
    const specifier = statement.exportClause.elements.find((element) => element.name.text === name);
    if (!specifier || !statement.moduleSpecifier) continue;
    const module = resolveImportedSource(
      source,
      statement.moduleSpecifier.getText(source).replace(/^['"]|['"]$/g, ""),
    );
    if (!module) continue;
    return findExportedDeclaration(module, specifier.propertyName?.getText(source) ?? name);
  }

  return findDeclaration(source, name);
}

function resolveImportedSource(
  source: ts.SourceFile,
  specifier: string,
): ts.SourceFile | undefined {
  let base: string | undefined;
  if (specifier.startsWith(".")) {
    base = resolve(dirname(source.fileName), specifier);
  } else if (specifier.startsWith("@/lib/")) {
    base = resolve(root, "registry/lib", specifier.slice("@/lib/".length));
  } else if (specifier.startsWith("@/hooks/")) {
    base = resolve(root, "registry/hooks", specifier.slice("@/hooks/".length));
  }
  if (!base) return undefined;
  const candidates = [
    ...SOURCE_EXTENSIONS.map((extension) => `${base}${extension}`),
    ...SOURCE_EXTENSIONS.map((extension) => resolve(base, `index${extension}`)),
  ];
  const fileName = candidates.find((candidate) => sourceTypeIndex.sourcesByFile.has(candidate));
  return fileName ? sourceTypeIndex.sourcesByFile.get(fileName) : undefined;
}

export function getFunctionDoc(source: ts.SourceFile, functionName: string): string {
  let description = "";

  source.forEachChild((node) => {
    if (!ts.isFunctionDeclaration(node) || node.name?.text !== functionName) return;
    description = jsDocDescription(node);
  });

  return description;
}
