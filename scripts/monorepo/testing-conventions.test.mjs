import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
import { listRepoFiles } from "./lib/files.mjs";

const TEST_FILE_RE = /\.(?:test|spec)\.[cm]?[tj]sx?$/;
const FIRE_EVENT_CALL_RE = /\bfireEvent(?:\.\w+\s*\(|\s*\()/;
const UI_COMPONENT_FILE_RE = /^libs\/ui\/registry\/ui\/([^/]+)\//;
const UI_COMPONENT_TEST_RE = /^libs\/ui\/registry\/ui\/.+\.test\.tsx$/;
const UI_COMPONENT_DIRECT_TEST_RE = /^libs\/ui\/registry\/ui\/([^/]+)\/[^/]+\.test\.tsx$/;
const AXE_HELPER_MODULE = "../../../testing/axe";
const UI_TEST_AXE_EXEMPTIONS = new Map([
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
    "libs/ui/registry/ui/section-header/ssr/section-header.test.tsx",
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
]);
const UI_COMPONENT_TEST_EXEMPTIONS = new Map();

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

function describeCall(expression) {
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

function isFunctionLike(node) {
  return ts.isFunctionLike(node);
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
      const statement = parent.statements.find((candidate) => candidate === current);
      if (statement) {
        const index = parent.statements.indexOf(statement);
        if (parent.statements.slice(0, index).some(statementDefinitelyExits)) return true;
      }
    }
    current = parent;
  }
  return false;
}

function findContainingTestCallback(node, checker, testSymbols) {
  let current = node.parent;
  while (current && !isFunctionLike(current)) current = current.parent;
  return current && isEnabledTestCallback(current, checker, testSymbols) ? current : null;
}

function findEnclosingFunction(node) {
  let current = node.parent;
  while (current && !isFunctionLike(current)) current = current.parent;
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
      const testCallback = findContainingTestCallback(node, checker, testSymbols);
      if (
        symbol &&
        axeSymbols.has(symbol) &&
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

function sourceHasAwaitedAxeCall(source) {
  const fileName = "/axe-convention-fixture.tsx";
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
  return hasAwaitedAxeCall(sourceFile, program.getTypeChecker());
}

function listTestFiles() {
  return listRepoFiles().filter((file) => existsSync(file) && TEST_FILE_RE.test(file));
}

function listUiComponentFolders() {
  const folders = new Set();

  for (const file of listRepoFiles()) {
    if (!existsSync(file)) continue;
    const match = UI_COMPONENT_FILE_RE.exec(file);
    if (match) folders.add(match[1]);
  }

  return [...folders].sort();
}

test("retained fireEvent calls carry inline rationale", () => {
  const violations = [];

  for (const file of listTestFiles()) {
    const lines = readFileSync(file, "utf8").split(/\r?\n/);

    lines.forEach((line, index) => {
      if (line.trimStart().startsWith("//")) return;
      if (!FIRE_EVENT_CALL_RE.test(line)) return;

      const context = lines.slice(Math.max(0, index - 2), index + 1).join("\n");
      if (!context.includes("fireEvent retained:")) {
        violations.push(`${file}:${index + 1}: ${line.trim()}`);
      }
    });
  }

  assert.deepEqual(violations, []);
});

test("UI component tests run axe or document why axe is skipped", () => {
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

    const rationale = UI_COMPONENT_TEST_EXEMPTIONS.get(folder)?.trim();
    if (!rationale) {
      violations.push(`libs/ui/registry/ui/${folder}/`);
    }
  }

  for (const [file, rationale] of UI_TEST_AXE_EXEMPTIONS) {
    if (!rationale.trim()) violations.push(`${file}: empty axe exemption`);
    if (!uiTestFiles.includes(file)) violations.push(`${file}: stale axe exemption`);
  }

  for (const [folder, rationale] of UI_COMPONENT_TEST_EXEMPTIONS) {
    if (!rationale.trim()) violations.push(`libs/ui/registry/ui/${folder}/: empty axe exemption`);
    if (!componentFolders.includes(folder)) {
      violations.push(`libs/ui/registry/ui/${folder}/: stale axe exemption`);
    }
  }

  assert.deepEqual(violations, []);
});

test("axe convention requires an awaited call resolved to the approved helper import", () => {
  const rejected = [
    `import { it } from "vitest"; it("runs axe()", () => {});`,
    `// await axe(container)`,
    `import { axe } from "${AXE_HELPER_MODULE}";`,
    `import { it } from "vitest"; import { axe } from "${AXE_HELPER_MODULE}"; it("audit", () => { axe(container); });`,
    `// axe skipped: x`,
    `import { it } from "vitest"; import { axe } from "${AXE_HELPER_MODULE}"; it("audit", async () => { const axe = async () => {}; await axe(); });`,
    `import { axe } from "${AXE_HELPER_MODULE}"; async function audit() { await axe(container); }`,
    `import { it } from "vitest"; import { axe } from "${AXE_HELPER_MODULE}"; it.skip("audit", async () => { await axe(container); });`,
    `import { describe, it } from "vitest"; import { axe } from "${AXE_HELPER_MODULE}"; describe.skip("suite", () => { it("audit", async () => { await axe(container); }); });`,
    `import { describe, it } from "vitest"; import { axe } from "${AXE_HELPER_MODULE}"; describe["skip"]("suite", () => { it("audit", async () => { await axe(container); }); });`,
    `import { describe, it } from "vitest"; import { axe } from "${AXE_HELPER_MODULE}"; const mode = "skip"; describe[mode]("suite", () => { it("audit", async () => { await axe(container); }); });`,
    `import { it } from "vitest"; import { axe } from "${AXE_HELPER_MODULE}"; function neverCalled() { it("audit", async () => { await axe(container); }); }`,
    `import { it } from "vitest"; import { axe } from "${AXE_HELPER_MODULE}"; const neverCalled = () => { it("audit", async () => { await axe(container); }); };`,
    `import { it } from "vitest"; import { axe } from "${AXE_HELPER_MODULE}"; wrapper(() => { it("audit", async () => { await axe(container); }); });`,
    `import { it } from "vitest"; import { axe } from "${AXE_HELPER_MODULE}"; if (false) { it("audit", async () => { await axe(container); }); }`,
    `import { it } from "vitest"; import { axe } from "${AXE_HELPER_MODULE}"; false && it("audit", async () => { await axe(container); });`,
    `import { it } from "vitest"; import { axe } from "${AXE_HELPER_MODULE}"; it("audit", async () => { if (false) { await axe(container); } });`,
    `import { it } from "vitest"; import { axe } from "${AXE_HELPER_MODULE}"; it("audit", async () => { async function dead() { await axe(container); } });`,
    `import { it } from "vitest"; import { axe } from "${AXE_HELPER_MODULE}"; it("audit", async () => { const dead = { async run() { await axe(container); } }; });`,
    `import { it } from "vitest"; import { axe } from "${AXE_HELPER_MODULE}"; it("audit", async () => { return; await axe(container); });`,
    `import { it } from "vitest"; import { axe } from "${AXE_HELPER_MODULE}"; it("audit", async () => { false ? await axe(container) : undefined; });`,
    `import { it } from "vitest"; import { axe } from "${AXE_HELPER_MODULE}"; it("audit", async () => { false && await axe(container); });`,
    `import { it } from "vitest"; import { axe } from "${AXE_HELPER_MODULE}"; it("audit", async () => { true || await axe(container); });`,
    `import { axe } from "${AXE_HELPER_MODULE}"; function it(_name, _callback) {} it("audit", async () => { await axe(container); });`,
    `import { axe } from "${AXE_HELPER_MODULE}"; const it = () => () => {}; it()("audit", async () => { await axe(container); });`,
  ];

  for (const source of rejected) {
    assert.equal(sourceHasAwaitedAxeCall(source), false, source);
  }

  assert.equal(
    sourceHasAwaitedAxeCall(
      `import { it as scenario } from "vitest"; import { axe as runAxe } from "${AXE_HELPER_MODULE}"; scenario("audit", async () => { expect(await runAxe(container)).toHaveNoViolations(); });`,
    ),
    true,
  );
  assert.equal(
    sourceHasAwaitedAxeCall(
      `import { it } from "vitest"; import { axe } from "${AXE_HELPER_MODULE}"; it("audit", async () => { do { await axe(container); } while (false); });`,
    ),
    true,
  );
  assert.equal(
    sourceHasAwaitedAxeCall(
      `import { describe, it } from "vitest"; import { axe } from "${AXE_HELPER_MODULE}"; describe("suite", () => { it("audit", async () => { await axe(container); }); });`,
    ),
    true,
  );
});
