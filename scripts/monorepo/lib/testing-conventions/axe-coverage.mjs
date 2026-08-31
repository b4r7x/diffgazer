// The `test:scripts` gate for UI component axe coverage: every
// libs/ui/registry/ui suite must reach a live `expect(await axe(...))
// .toHaveNoViolations()` — resolved to the approved helper import, inside a test
// callback that actually registers and runs — or declare an exemption below.
// Asserted by ../../testing-conventions.test.mjs.

import ts from "typescript";
import { listRepoFiles } from "../files.mjs";
import { createFixtureSourceFile, describeCall, listTestFiles } from "./ts-program.mjs";

const UI_COMPONENT_FILE_RE = /^libs\/ui\/registry\/ui\/([^/]+)\//;
const UI_COMPONENT_TEST_RE = /^libs\/ui\/registry\/ui\/.+\.test\.tsx$/;
const UI_COMPONENT_DIRECT_TEST_RE = /^libs\/ui\/registry\/ui\/([^/]+)\/[^/]+\.test\.tsx$/;
export const AXE_HELPER_MODULE = "../../../testing/axe";
const UI_TEST_AXE_EXEMPTIONS = new Map([
  [
    "libs/ui/registry/ui/code-block/code-block.test.tsx",
    "code-block-accessibility.test.tsx owns the axe audit across all CodeBlock variants.",
  ],
  [
    "libs/ui/registry/ui/code-block/code-block-copy-button.test.tsx",
    "code-block-accessibility.test.tsx owns the axe audit; this file isolates clipboard behavior.",
  ],
  [
    "libs/ui/registry/ui/code-block/highlight.test.tsx",
    "code-block-accessibility.test.tsx owns the axe audit; this file isolates lowlight tokenization.",
  ],
  [
    "libs/ui/registry/ui/block-bar/block-bar.test.tsx",
    "Meter label, value, minimum, and maximum semantics are asserted directly.",
  ],
  [
    "libs/ui/registry/ui/divider/divider.test.tsx",
    "Decorative and separator semantics are asserted directly for each mode.",
  ],
  [
    "libs/ui/registry/ui/logo/logo.test.tsx",
    "The decorative branding mark's accessible name is covered by role and text queries.",
  ],
  [
    "libs/ui/registry/ui/overflow/overflow.test.tsx",
    "Mocked layout dimensions cannot provide a meaningful overflow audit in jsdom.",
  ],
  [
    "libs/ui/registry/ui/section-header/section-header.ssr.test.tsx",
    "The SSR contract is parsed in a detached document rather than rendered as standalone UI.",
  ],
  [
    "libs/ui/registry/ui/shared/component-props-ref.test.tsx",
    "This is a type and ref contract; consumer component suites own accessibility coverage.",
  ],
  [
    "libs/ui/registry/ui/shared/dialog-shell.test.tsx",
    "This internal overlay shell has no standalone UI; consumer dialogs own accessibility coverage.",
  ],
  [
    "libs/ui/registry/ui/shared/nested-overlay-escape.test.tsx",
    "This test isolates escape arbitration; dialog and popover suites own accessibility coverage.",
  ],
  [
    "libs/ui/registry/ui/shared/nested-overlay-pointerdown.test.tsx",
    "This test isolates outside-press arbitration; dialog and select suites own accessibility coverage.",
  ],
  [
    "libs/ui/registry/ui/shared/portal-dialog.test.tsx",
    "This test isolates portal-tree integration; consumer overlay suites own accessibility coverage.",
  ],
  [
    "libs/ui/registry/ui/shared/portal.test.tsx",
    "This internal portal has no standalone UI; consumer overlay suites own accessibility coverage.",
  ],
  [
    "libs/ui/registry/ui/typography/typography.test.tsx",
    "Semantics depend on the element selected by the consumer and are asserted directly.",
  ],
  [
    "libs/ui/registry/ui/stepper/stepper-navigation.test.tsx",
    "stepper.test.tsx owns the axe audit; this file isolates focus and owner-document navigation.",
  ],
  [
    "libs/ui/registry/ui/stepper/stepper-announcements.test.tsx",
    "stepper.test.tsx owns the axe audit; this file isolates live-region announcements.",
  ],
  [
    "libs/ui/registry/ui/stepper/stepper-variants.test.tsx",
    "stepper.test.tsx owns the axe audit; this file isolates variant rendering.",
  ],
  [
    "libs/ui/registry/ui/stepper/stepper-motion.test.tsx",
    "stepper.test.tsx owns the axe audit; this file isolates reduced-motion behavior.",
  ],
  [
    "libs/ui/registry/ui/radio/radio-group-keyboard.test.tsx",
    "radio-group.test.tsx owns the axe audit; this file isolates roving focus and arrow navigation.",
  ],
  [
    "libs/ui/registry/ui/radio/radio-group-form.test.tsx",
    "radio-group.test.tsx owns the axe audit; this file isolates native form, reset, and validation behavior.",
  ],
  [
    "libs/ui/registry/ui/toast/toast-keyboard.test.tsx",
    "toast.test.tsx owns the axe audit; this file isolates region focus management and top-layer behavior.",
  ],
  [
    "libs/ui/registry/ui/toast/toast-announcements.test.tsx",
    "toast.test.tsx owns the axe audit; this file isolates live-region announcement routing.",
  ],
  [
    "libs/ui/registry/ui/toast/toast-timing.test.tsx",
    "toast.test.tsx owns the axe audit; this file isolates auto-dismiss pause and resume timing.",
  ],
  [
    "libs/ui/registry/ui/toast/toast-variants.test.tsx",
    "toast.test.tsx owns the axe audit; this file isolates variant layout rendering.",
  ],
  [
    "libs/ui/registry/ui/dialog/dialog-header.test.tsx",
    "dialog.test.tsx owns the axe audit; this file isolates the header strip and title meta slots.",
  ],
  [
    "libs/ui/registry/ui/dialog/dialog.css.test.tsx",
    "dialog.test.tsx owns the axe audit; this file isolates shipped CSS declarations.",
  ],
  [
    "libs/ui/registry/ui/field/field-ssr.test.tsx",
    "The server output is parsed before hydration rather than rendered as interactive UI.",
  ],
  [
    "libs/ui/registry/ui/toggle-group/toggle-group-keyboard.test.tsx",
    "toggle-group.test.tsx owns the axe audit; this file isolates roving focus and arrow navigation.",
  ],
  [
    "libs/ui/registry/ui/toggle-group/toggle-group-form.test.tsx",
    "toggle-group.test.tsx owns the axe audit; this file isolates native form, reset, and SSR behavior.",
  ],
  [
    "libs/ui/registry/ui/toggle-group/toggle-group-variants.test.tsx",
    "toggle-group.test.tsx owns the axe audit; this file isolates variant rendering.",
  ],
]);
function findAxeImportSymbols(sourceFile, checker) {
  const symbols = new Set();

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
    if (statement.moduleSpecifier.text !== AXE_HELPER_MODULE) continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;

    for (const element of bindings.elements) {
      const importedName = element.propertyName?.text ?? element.name.text;
      if (importedName !== "axe") continue;
      const symbol = checker.getSymbolAtLocation(element.name);
      if (symbol) symbols.add(symbol);
    }
  }

  return symbols;
}

function findVitestSymbols(sourceFile, checker) {
  const testSymbols = new Set();
  const describeSymbols = new Set();

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
    if (statement.moduleSpecifier.text !== "vitest") continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;

    for (const element of bindings.elements) {
      const importedName = element.propertyName?.text ?? element.name.text;
      const symbol = checker.getSymbolAtLocation(element.name);
      if (!symbol) continue;
      if (importedName === "it" || importedName === "test") testSymbols.add(symbol);
      if (importedName === "describe") describeSymbols.add(symbol);
    }
  }

  return { describeSymbols, testSymbols };
}

function isEnabledTestCallback(node, checker, testSymbols) {
  if (
    (!ts.isArrowFunction(node) && !ts.isFunctionExpression(node)) ||
    !ts.isCallExpression(node.parent)
  ) {
    return false;
  }
  if (!node.parent.arguments.includes(node)) return false;
  const descriptor = describeCall(node.parent.expression);
  if (!descriptor) return false;
  const symbol = checker.getSymbolAtLocation(descriptor.baseNode);
  if (!symbol || !testSymbols.has(symbol)) return false;
  return descriptor.modifiers.every((modifier) =>
    ["each", "only", "concurrent", "sequential"].includes(modifier),
  );
}

function isEnabledDescribeCallback(node, checker, describeSymbols) {
  if (
    (!ts.isArrowFunction(node) && !ts.isFunctionExpression(node)) ||
    !ts.isCallExpression(node.parent) ||
    !node.parent.arguments.includes(node)
  ) {
    return false;
  }
  const descriptor = describeCall(node.parent.expression);
  if (!descriptor) return false;
  const symbol = checker.getSymbolAtLocation(descriptor.baseNode);
  return (
    symbol !== undefined &&
    describeSymbols.has(symbol) &&
    descriptor.modifiers.every((modifier) =>
      ["each", "only", "concurrent", "sequential"].includes(modifier),
    )
  );
}

function isWithinStaticDeadBranch(node, testCallback) {
  let current = node;
  while (current !== testCallback) {
    const parent = current.parent;
    if (!parent) return true;
    if (ts.isIfStatement(parent)) {
      if (parent.expression.kind === ts.SyntaxKind.FalseKeyword && parent.thenStatement === current)
        return true;
      if (parent.expression.kind === ts.SyntaxKind.TrueKeyword && parent.elseStatement === current)
        return true;
    }
    if (ts.isConditionalExpression(parent)) {
      if (parent.condition.kind === ts.SyntaxKind.FalseKeyword && parent.whenTrue === current)
        return true;
      if (parent.condition.kind === ts.SyntaxKind.TrueKeyword && parent.whenFalse === current)
        return true;
    }
    if (ts.isBinaryExpression(parent) && parent.right === current) {
      const leftKind = parent.left.kind;
      if (
        (parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
          leftKind === ts.SyntaxKind.FalseKeyword) ||
        (parent.operatorToken.kind === ts.SyntaxKind.BarBarToken &&
          leftKind === ts.SyntaxKind.TrueKeyword) ||
        (parent.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken &&
          (leftKind === ts.SyntaxKind.TrueKeyword || leftKind === ts.SyntaxKind.FalseKeyword))
      ) {
        return true;
      }
    }
    if (
      ts.isWhileStatement(parent) &&
      parent.expression.kind === ts.SyntaxKind.FalseKeyword &&
      parent.statement === current
    ) {
      return true;
    }
    if (
      ts.isForStatement(parent) &&
      parent.condition?.kind === ts.SyntaxKind.FalseKeyword &&
      parent.statement === current
    ) {
      return true;
    }
    current = parent;
  }
  return false;
}

function statementDefinitelyExits(statement) {
  if (ts.isReturnStatement(statement) || ts.isThrowStatement(statement)) return true;
  if (ts.isBlock(statement)) {
    const last = statement.statements.at(-1);
    return last ? statementDefinitelyExits(last) : false;
  }
  return (
    ts.isIfStatement(statement) &&
    statement.elseStatement !== undefined &&
    statementDefinitelyExits(statement.thenStatement) &&
    statementDefinitelyExits(statement.elseStatement)
  );
}

function isAfterUnconditionalExit(node, testCallback) {
  let current = node;
  while (current !== testCallback) {
    const parent = current.parent;
    if (!parent) return true;
    if (ts.isBlock(parent)) {
      const index = parent.statements.indexOf(current);
      if (index > 0 && parent.statements.slice(0, index).some(statementDefinitelyExits))
        return true;
    }
    current = parent;
  }
  return false;
}

function findContainingTestCallback(node, checker, testSymbols) {
  let current = node.parent;
  while (current && !ts.isFunctionLike(current)) current = current.parent;
  return current && isEnabledTestCallback(current, checker, testSymbols) ? current : null;
}

function findEnclosingFunction(node) {
  let current = node.parent;
  while (current && !ts.isFunctionLike(current)) current = current.parent;
  return current ?? null;
}

function hasReachableTestRegistration(testCallback, checker, describeSymbols) {
  let registration = testCallback;

  while (true) {
    const enclosingFunction = findEnclosingFunction(registration);
    const boundary = enclosingFunction ?? registration.getSourceFile();
    if (
      isWithinStaticDeadBranch(registration, boundary) ||
      isAfterUnconditionalExit(registration, boundary)
    ) {
      return false;
    }
    if (!enclosingFunction) return true;
    if (!isEnabledDescribeCallback(enclosingFunction, checker, describeSymbols)) return false;
    registration = enclosingFunction;
  }
}

function isNonNegatedToHaveNoViolationsAssertion(expectCall) {
  let current = expectCall;
  while (true) {
    const parent = current.parent;
    if (!parent || !ts.isPropertyAccessExpression(parent) || parent.expression !== current) {
      return false;
    }
    if (parent.name.text === "not") return false;
    if (parent.name.text === "toHaveNoViolations") {
      return ts.isCallExpression(parent.parent) && parent.parent.expression === parent;
    }
    current = parent;
  }
}

function hasAwaitedAxeCall(sourceFile, checker) {
  const axeSymbols = findAxeImportSymbols(sourceFile, checker);
  const { describeSymbols, testSymbols } = findVitestSymbols(sourceFile, checker);
  if (axeSymbols.size === 0 || testSymbols.size === 0) return false;

  let found = false;
  function visit(node) {
    if (found) return;
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      ts.isAwaitExpression(node.parent)
    ) {
      const symbol = checker.getSymbolAtLocation(node.expression);
      const awaitExpression = node.parent;
      const expectCall = awaitExpression.parent;
      const testCallback = findContainingTestCallback(node, checker, testSymbols);
      if (
        symbol &&
        axeSymbols.has(symbol) &&
        ts.isCallExpression(expectCall) &&
        ts.isIdentifier(expectCall.expression) &&
        expectCall.expression.text === "expect" &&
        expectCall.arguments[0] === awaitExpression &&
        isNonNegatedToHaveNoViolationsAssertion(expectCall) &&
        testCallback &&
        hasReachableTestRegistration(testCallback, checker, describeSymbols) &&
        !isWithinStaticDeadBranch(node, testCallback) &&
        !isAfterUnconditionalExit(node, testCallback)
      ) {
        found = true;
        return;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return found;
}

export function sourceHasAwaitedAxeCall(source) {
  const { sourceFile, checker } = createFixtureSourceFile(source, "/axe-convention-fixture.tsx");
  return hasAwaitedAxeCall(sourceFile, checker);
}

function listUiComponentFolders() {
  const folders = new Set();

  for (const file of listRepoFiles()) {
    const match = UI_COMPONENT_FILE_RE.exec(file);
    if (match) folders.add(match[1]);
  }

  return [...folders].sort();
}

export function collectAxeCoverageViolations() {
  const violations = [];
  const componentFolders = listUiComponentFolders();
  const foldersWithDirectTests = new Set();
  const uiTestFiles = listTestFiles().filter((path) => UI_COMPONENT_TEST_RE.test(path));
  const program = ts.createProgram(uiTestFiles, {
    jsx: ts.JsxEmit.Preserve,
    noLib: true,
    noResolve: true,
  });
  const checker = program.getTypeChecker();

  for (const file of uiTestFiles) {
    const directTestMatch = UI_COMPONENT_DIRECT_TEST_RE.exec(file);
    if (directTestMatch) foldersWithDirectTests.add(directTestMatch[1]);

    const sourceFile = program.getSourceFile(file);
    const rationale = UI_TEST_AXE_EXEMPTIONS.get(file)?.trim();
    if ((!sourceFile || !hasAwaitedAxeCall(sourceFile, checker)) && !rationale) {
      violations.push(file);
    }
  }

  for (const folder of componentFolders) {
    if (foldersWithDirectTests.has(folder)) continue;
    violations.push(`libs/ui/registry/ui/${folder}/`);
  }

  for (const [file, rationale] of UI_TEST_AXE_EXEMPTIONS) {
    if (!rationale.trim()) violations.push(`${file}: empty axe exemption`);
    if (!uiTestFiles.includes(file)) violations.push(`${file}: stale axe exemption`);
  }

  return violations;
}
