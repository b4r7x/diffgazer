import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AXE_HELPER_MODULE,
  collectAxeCoverageViolations,
  sourceHasAwaitedAxeCall,
} from "./lib/testing-conventions/axe-coverage.mjs";
import {
  collectFireEventViolations,
  FIRE_EVENT_MODULE,
  sourceFireEventCallsAreRationalized,
} from "./lib/testing-conventions/fire-event.mjs";

test("retained fireEvent calls carry inline rationale", () => {
  assert.deepEqual(collectFireEventViolations(), []);
});

test("UI component tests run axe or document why axe is skipped", () => {
  assert.deepEqual(collectAxeCoverageViolations(), []);
});

test("axe convention requires an awaited call resolved to the approved helper import and asserted with toHaveNoViolations()", () => {
  const rejected = [
    `import { it } from "vitest"; it("runs axe()", () => {});`,
    `// await axe(container)`,
    `import { axe } from "${AXE_HELPER_MODULE}";`,
    `import { it } from "vitest"; import { axe } from "${AXE_HELPER_MODULE}"; it("audit", () => { axe(container); });`,
    `// axe skipped: x`,
    `import { it } from "vitest"; import { axe } from "${AXE_HELPER_MODULE}"; it("audit", async () => { await axe(container); });`,
    `import { it } from "vitest"; import { axe } from "${AXE_HELPER_MODULE}"; it("audit", async () => { expect(await axe(container)).not.toHaveNoViolations(); });`,
    `import { it } from "vitest"; import { axe } from "${AXE_HELPER_MODULE}"; it("audit", async () => { const axe = async () => {}; expect(await axe()).toHaveNoViolations(); });`,
    `import { it } from "vitest"; import { axe } from "${AXE_HELPER_MODULE}"; async function audit() { expect(await axe(container)).toHaveNoViolations(); }`,
    `import { it } from "vitest"; import { axe } from "${AXE_HELPER_MODULE}"; it.skip("audit", async () => { expect(await axe(container)).toHaveNoViolations(); });`,
    `import { describe, it } from "vitest"; import { axe } from "${AXE_HELPER_MODULE}"; describe.skip("suite", () => { it("audit", async () => { expect(await axe(container)).toHaveNoViolations(); }); });`,
    `import { describe, it } from "vitest"; import { axe } from "${AXE_HELPER_MODULE}"; describe["skip"]("suite", () => { it("audit", async () => { expect(await axe(container)).toHaveNoViolations(); }); });`,
    `import { describe, it } from "vitest"; import { axe } from "${AXE_HELPER_MODULE}"; const mode = "skip"; describe[mode]("suite", () => { it("audit", async () => { expect(await axe(container)).toHaveNoViolations(); }); });`,
    `import { it } from "vitest"; import { axe } from "${AXE_HELPER_MODULE}"; function neverCalled() { it("audit", async () => { expect(await axe(container)).toHaveNoViolations(); }); }`,
    `import { it } from "vitest"; import { axe } from "${AXE_HELPER_MODULE}"; const neverCalled = () => { it("audit", async () => { expect(await axe(container)).toHaveNoViolations(); }); };`,
    `import { it } from "vitest"; import { axe } from "${AXE_HELPER_MODULE}"; wrapper(() => { it("audit", async () => { expect(await axe(container)).toHaveNoViolations(); }); });`,
    `import { it } from "vitest"; import { axe } from "${AXE_HELPER_MODULE}"; if (false) { it("audit", async () => { expect(await axe(container)).toHaveNoViolations(); }); }`,
    `import { it } from "vitest"; import { axe } from "${AXE_HELPER_MODULE}"; false && it("audit", async () => { expect(await axe(container)).toHaveNoViolations(); });`,
    `import { it } from "vitest"; import { axe } from "${AXE_HELPER_MODULE}"; it("audit", async () => { if (false) { expect(await axe(container)).toHaveNoViolations(); } });`,
    `import { it } from "vitest"; import { axe } from "${AXE_HELPER_MODULE}"; it("audit", async () => { async function dead() { expect(await axe(container)).toHaveNoViolations(); } });`,
    `import { it } from "vitest"; import { axe } from "${AXE_HELPER_MODULE}"; it("audit", async () => { const dead = { async run() { expect(await axe(container)).toHaveNoViolations(); } }; });`,
    `import { it } from "vitest"; import { axe } from "${AXE_HELPER_MODULE}"; it("audit", async () => { return; expect(await axe(container)).toHaveNoViolations(); });`,
    `import { it } from "vitest"; import { axe } from "${AXE_HELPER_MODULE}"; it("audit", async () => { false ? expect(await axe(container)).toHaveNoViolations() : undefined; });`,
    `import { it } from "vitest"; import { axe } from "${AXE_HELPER_MODULE}"; it("audit", async () => { false && expect(await axe(container)).toHaveNoViolations(); });`,
    `import { it } from "vitest"; import { axe } from "${AXE_HELPER_MODULE}"; it("audit", async () => { true || expect(await axe(container)).toHaveNoViolations(); });`,
    `import { it as vit } from "vitest"; import { axe } from "${AXE_HELPER_MODULE}"; function it(_name, _callback) {} it("audit", async () => { expect(await axe(container)).toHaveNoViolations(); });`,
    `import { it as vit } from "vitest"; import { axe } from "${AXE_HELPER_MODULE}"; const it = () => () => {}; it()("audit", async () => { expect(await axe(container)).toHaveNoViolations(); });`,
  ];

  for (const source of rejected) {
    assert.equal(sourceHasAwaitedAxeCall(source), false, source);
  }

  assert.equal(
    sourceHasAwaitedAxeCall(
      `import { it } from "vitest"; import { axe } from "${AXE_HELPER_MODULE}"; it("audit", async () => { expect(await axe(container)).toHaveNoViolations(); });`,
    ),
    true,
  );
  assert.equal(
    sourceHasAwaitedAxeCall(
      `import { it as scenario } from "vitest"; import { axe as runAxe } from "${AXE_HELPER_MODULE}"; scenario("audit", async () => { expect(await runAxe(container)).toHaveNoViolations(); });`,
    ),
    true,
  );
  assert.equal(
    sourceHasAwaitedAxeCall(
      `import { it } from "vitest"; import { axe } from "${AXE_HELPER_MODULE}"; it("audit", async () => { do { expect(await axe(container)).toHaveNoViolations(); } while (false); });`,
    ),
    true,
  );
  assert.equal(
    sourceHasAwaitedAxeCall(
      `import { describe, it } from "vitest"; import { axe } from "${AXE_HELPER_MODULE}"; describe("suite", () => { it("audit", async () => { expect(await axe(container)).toHaveNoViolations(); }); });`,
    ),
    true,
  );
});

test("fireEvent rationale convention requires a resolved call paired with a real leading comment", () => {
  const rejected = [
    `import { it } from "vitest";
import { fireEvent } from "${FIRE_EVENT_MODULE}";
it("audit", () => {
  fireEvent.click(button);
});`,
    `import { it } from "vitest";
import { fireEvent } from "${FIRE_EVENT_MODULE}";
it("audit", () => {
  const rationale = "fireEvent retained: fake";
  fireEvent.click(button);
});`,
    `import { it } from "vitest";
import { fireEvent as fe } from "${FIRE_EVENT_MODULE}";
it("audit", () => {
  fe(button, new Event("click"));
});`,
    `import { it } from "vitest";
import { fireEvent } from "${FIRE_EVENT_MODULE}";
it("audit", () => {
  fireEvent
    .click(button);
});`,
  ];

  for (const source of rejected) {
    assert.equal(sourceFireEventCallsAreRationalized(source), false, source);
  }

  assert.equal(
    sourceFireEventCallsAreRationalized(
      `import { it } from "vitest";
import { fireEvent } from "${FIRE_EVENT_MODULE}";
it("audit", () => {
  // fireEvent retained: native dispatch exercises the exact browser event shape.
  fireEvent.click(button);
});`,
    ),
    true,
  );
  assert.equal(
    sourceFireEventCallsAreRationalized(
      `import { it } from "vitest";
import { fireEvent as fe } from "${FIRE_EVENT_MODULE}";
it("audit", () => {
  // fireEvent retained: aliased callable form resolves to the imported binding.
  fe(button, new Event("click"));
});`,
    ),
    true,
  );
  assert.equal(
    sourceFireEventCallsAreRationalized(
      `import { it } from "vitest";
import { fireEvent as fe } from "${FIRE_EVENT_MODULE}";
it("audit", () => {
  // fireEvent retained: aliased member access resolves across the wrapped property chain.
  fe
    .click(button);
});`,
    ),
    true,
  );
});
