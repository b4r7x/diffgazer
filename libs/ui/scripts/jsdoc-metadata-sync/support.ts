import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

export const root = resolve(import.meta.dirname, "../..");

export function readSource(relativePath: string): ts.SourceFile {
  const fileName = resolve(root, relativePath);
  const source = readFileSync(fileName, "utf8");
  return ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
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

  source.forEachChild((node) => {
    if (ts.isInterfaceDeclaration(node) && node.name.text === interfaceName) {
      collectMemberDocs(source, node.members, docs);
      return;
    }

    if (ts.isTypeAliasDeclaration(node) && node.name.text === interfaceName) {
      collectTypeMemberDocs(source, node.type, docs);
    }
  });

  return docs;
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
    docs.set(normalizeMemberName(member.name.getText(source)), jsDocDescription(member));
  }
}

function collectTypeMemberDocs(
  source: ts.SourceFile,
  node: ts.TypeNode,
  docs: Map<string, string>,
): void {
  if (ts.isTypeLiteralNode(node)) {
    collectMemberDocs(source, node.members, docs);
    return;
  }

  if (ts.isIntersectionTypeNode(node)) {
    for (const type of node.types) collectTypeMemberDocs(source, type, docs);
  }
}

export function getFunctionDoc(source: ts.SourceFile, functionName: string): string {
  let description = "";

  source.forEachChild((node) => {
    if (!ts.isFunctionDeclaration(node) || node.name?.text !== functionName) return;
    description = jsDocDescription(node);
  });

  return description;
}
