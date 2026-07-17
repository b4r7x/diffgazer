/**
 * @vitest-environment jsdom
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "@testing-library/react";
import { createElement, type KeyboardEvent, useRef } from "react";
import { describe, expect, it } from "vitest";
import { testNavigationBehavior } from "./navigation-behavior.js";

const readme = readFileSync(resolve(import.meta.dirname, "../../README.md"), "utf8");

function NavigationFixture() {
  const secondRef = useRef<HTMLButtonElement>(null);

  return createElement(
    "div",
    {
      onKeyDown: (event: KeyboardEvent) => {
        if (event.key === "ArrowRight") secondRef.current?.focus();
      },
    },
    createElement("button", { type: "button", "data-value": "One" }, "One"),
    createElement("button", { ref: secondRef, type: "button", "data-value": "Two" }, "Two"),
  );
}

describe("testNavigationBehavior", () => {
  it("documents the exact optional peer setup and public import", () => {
    expect(readme).toContain(
      "npm install --save-dev @testing-library/react@^16.3.2 @testing-library/user-event@^14.6.1 vitest@^4.1.0",
    );
    expect(readme).toContain(
      'import { testNavigationBehavior } from "@diffgazer/keys/testing/navigation-behavior";',
    );
  });

  testNavigationBehavior({
    setup: () => {
      const rendered = render(createElement(NavigationFixture));
      rendered.getByRole("button", { name: "One" }).focus();
      return rendered;
    },
    items: ["One", "Two"],
    initialActive: 0,
    cases: [{ key: "{ArrowRight}", expectedActiveIndex: 1 }],
  });
});
