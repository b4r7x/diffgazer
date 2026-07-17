// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { DiffView } from "../ui/diff-view";
import { diffViewDoc } from "./diff-view";

function dataAttribute(name: string) {
  return diffViewDoc.dataAttributes?.find((entry) => entry.attribute === name);
}

describe("DiffView component metadata", () => {
  it("describes data-mode and data-line-numbers on their rendered hosts", () => {
    const { container, rerender } = render(
      createElement(DiffView, {
        patch: "@@ -1 +1 @@\n-old\n+new",
        mode: "unified",
        showLineNumbers: false,
      }),
    );

    const figure = container.querySelector('[data-slot="diff-view"]');
    const rows = container.querySelector('[data-slot="diff-view-rows"]');
    expect(figure).toHaveAttribute("data-mode", "unified");
    expect(rows).toHaveAttribute("data-line-numbers", "false");
    expect(dataAttribute("data-mode")).toMatchObject({
      appliesTo: "DiffView",
      values: '"unified" | "split"',
    });
    expect(dataAttribute("data-line-numbers")).toMatchObject({
      appliesTo: "DiffView rows",
      values: '"true" | "false"',
    });

    rerender(
      createElement(DiffView, {
        patch: "@@ -1 +1 @@\n-old\n+new",
        mode: "split",
        showLineNumbers: true,
      }),
    );
    expect(figure).toHaveAttribute("data-mode", "split");
    const splitRows = container.querySelectorAll('[data-slot="diff-view-rows"]');
    expect(splitRows).toHaveLength(2);
    for (const side of splitRows) {
      expect(side).toHaveAttribute("data-line-numbers", "true");
    }
  });
});
