// Shared TypeScript-AST plumbing for the `test:scripts` testing-convention
// gates: the callee descriptor both scanners resolve symbols through, the
// single-file fixture program the unit tests parse, and the repo test-file list.

import ts from "typescript";
import { listRepoFiles } from "../files.mjs";

const TEST_FILE_RE = /\.(?:test|spec)\.[cm]?[tj]sx?$/;

export function describeCall(expression) {
  if (ts.isIdentifier(expression)) {
    return { base: expression.text, baseNode: expression, modifiers: [] };
  }
  if (ts.isPropertyAccessExpression(expression)) {
    const descriptor = describeCall(expression.expression);
    return descriptor
      ? {
          base: descriptor.base,
          baseNode: descriptor.baseNode,
          modifiers: [...descriptor.modifiers, expression.name.text],
        }
      : null;
  }
  if (ts.isElementAccessExpression(expression)) {
    const descriptor = describeCall(expression.expression);
    if (!descriptor) return null;
    const modifier = ts.isStringLiteral(expression.argumentExpression)
      ? expression.argumentExpression.text
      : "<dynamic>";
    return {
      base: descriptor.base,
      baseNode: descriptor.baseNode,
      modifiers: [...descriptor.modifiers, modifier],
    };
  }
  if (ts.isCallExpression(expression)) return describeCall(expression.expression);
  return null;
}

export function createFixtureSourceFile(source, fileName) {
  const options = { jsx: ts.JsxEmit.Preserve, noLib: true, noResolve: true };
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const defaultHost = ts.createCompilerHost(options);
  const host = {
    ...defaultHost,
    fileExists: (path) => path === fileName || defaultHost.fileExists(path),
    readFile: (path) => (path === fileName ? source : defaultHost.readFile(path)),
    getSourceFile: (path, ...args) =>
      path === fileName ? sourceFile : defaultHost.getSourceFile(path, ...args),
  };
  const program = ts.createProgram([fileName], options, host);
  return { sourceFile, checker: program.getTypeChecker() };
}

export function listTestFiles() {
  return listRepoFiles().filter((file) => TEST_FILE_RE.test(file));
}
