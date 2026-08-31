// The `test:scripts` gate for retained `fireEvent` calls: every call resolved to
// the Testing Library import must carry an inline `fireEvent retained:` rationale
// on one of the two lines above it. Asserted by ../../testing-conventions.test.mjs.

import { readFileSync } from "node:fs";
import ts from "typescript";
import { createFixtureSourceFile, describeCall, listTestFiles } from "./ts-program.mjs";

export const FIRE_EVENT_MODULE = "@testing-library/react";
const FIRE_EVENT_SOURCE_MODULES = new Set([FIRE_EVENT_MODULE, "@testing-library/dom"]);
const FIRE_EVENT_RETAINED_TEXT = "fireEvent retained:";
const FIRE_EVENT_COMMENT_LOOKBACK_LINES = 2;

function findFireEventImportSymbols(sourceFile, checker) {
  const symbols = new Set();

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
    if (!FIRE_EVENT_SOURCE_MODULES.has(statement.moduleSpecifier.text)) continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;

    for (const element of bindings.elements) {
      const importedName = element.propertyName?.text ?? element.name.text;
      if (importedName !== "fireEvent") continue;
      const symbol = checker.getSymbolAtLocation(element.name);
      if (symbol) symbols.add(symbol);
    }
  }

  return symbols;
}

function collectRealComments(sourceFile) {
  const text = sourceFile.text;
  const seenStarts = new Set();
  const comments = [];

  function collectLeadingComments(pos) {
    for (const range of ts.getLeadingCommentRanges(text, pos) ?? []) {
      if (seenStarts.has(range.pos)) continue;
      seenStarts.add(range.pos);
      comments.push({
        text: text.slice(range.pos, range.end),
        endLine: sourceFile.getLineAndCharacterOfPosition(range.end).line,
      });
    }
  }

  function visit(node) {
    collectLeadingComments(node.getFullStart());
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return comments;
}

function collectFireEventCalls(sourceFile, checker, fireEventSymbols) {
  const calls = [];

  function visit(node) {
    if (ts.isCallExpression(node)) {
      const descriptor = describeCall(node.expression);
      const symbol = descriptor && checker.getSymbolAtLocation(descriptor.baseNode);
      if (symbol && fireEventSymbols.has(symbol)) calls.push(node);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return calls;
}

function isFireEventCallRationalized(callNode, sourceFile, comments) {
  const callLine = sourceFile.getLineAndCharacterOfPosition(callNode.getStart(sourceFile)).line;
  return comments.some((comment) => {
    if (!comment.text.includes(FIRE_EVENT_RETAINED_TEXT)) return false;
    const distance = callLine - comment.endLine;
    return distance >= 0 && distance <= FIRE_EVENT_COMMENT_LOOKBACK_LINES;
  });
}

export function sourceFireEventCallsAreRationalized(source) {
  const { sourceFile, checker } = createFixtureSourceFile(
    source,
    "/fire-event-convention-fixture.tsx",
  );
  const fireEventSymbols = findFireEventImportSymbols(sourceFile, checker);
  const comments = collectRealComments(sourceFile);
  return collectFireEventCalls(sourceFile, checker, fireEventSymbols).every((call) =>
    isFireEventCallRationalized(call, sourceFile, comments),
  );
}

export function collectFireEventViolations() {
  const violations = [];
  const candidateFiles = listTestFiles().filter((file) =>
    readFileSync(file, "utf8").includes("fireEvent"),
  );
  if (candidateFiles.length === 0) return violations;

  const program = ts.createProgram(candidateFiles, {
    jsx: ts.JsxEmit.Preserve,
    noLib: true,
    noResolve: true,
  });
  const checker = program.getTypeChecker();

  for (const file of candidateFiles) {
    const sourceFile = program.getSourceFile(file);
    if (!sourceFile) continue;
    const fireEventSymbols = findFireEventImportSymbols(sourceFile, checker);
    if (fireEventSymbols.size === 0) continue;

    const comments = collectRealComments(sourceFile);
    for (const call of collectFireEventCalls(sourceFile, checker, fireEventSymbols)) {
      if (isFireEventCallRationalized(call, sourceFile, comments)) continue;
      const line = sourceFile.getLineAndCharacterOfPosition(call.getStart(sourceFile)).line;
      violations.push(`${file}:${line + 1}: ${call.getText(sourceFile)}`);
    }
  }

  return violations;
}
