// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "@testing-library/react";
import { createElement, type Ref, useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { useComposedRefs } from "../hooks/use-composed-refs";

function ComposedRefRecipe({ externalRef }: { externalRef: Ref<HTMLDivElement> }) {
  const localRef = useRef<HTMLDivElement>(null);
  const composedRef = useComposedRefs(localRef, externalRef);
  return createElement("div", { ref: composedRef });
}

describe("composeRefs documentation recipes", () => {
  it("keeps component render examples on useComposedRefs", () => {
    const markdown = readFileSync(
      resolve(process.cwd(), "docs/content/utils/compose-refs.mdx"),
      "utf8",
    );

    expect(markdown).not.toContain("ref={composeRefs(");
    expect(markdown.match(/useComposedRefs/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it("does not detach and reattach stable refs on an ordinary rerender", () => {
    const externalRef = vi.fn();
    const view = render(createElement(ComposedRefRecipe, { externalRef }));
    const node = view.container.firstElementChild;

    expect(externalRef).toHaveBeenCalledTimes(1);
    expect(externalRef).toHaveBeenLastCalledWith(node);

    view.rerender(createElement(ComposedRefRecipe, { externalRef }));

    expect(externalRef).toHaveBeenCalledTimes(1);
  });
});
