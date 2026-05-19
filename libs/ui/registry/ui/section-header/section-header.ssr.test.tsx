import { renderToString } from "react-dom/server";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { SectionHeader } from "./index.js";

// axe skipped: SSR-only output check; full a11y is exercised by the companion client test.

describe("SectionHeader SSR", () => {
  it("server-renders the requested heading element", () => {
    const html = renderToString(<SectionHeader as="h2">Details</SectionHeader>);
    const dom = new JSDOM(html);

    // querySelector retained: SSR-string parsed by JSDOM; RTL screen/getByRole is not available against a detached jsdom document — direct DOM access is the only path
    const heading = dom.window.document.querySelector("h2");
    expect(heading?.tagName).toBe("H2");
    expect(heading?.textContent).toBe("Details");
  });

  it("renders a distinct className per heading level", () => {
    const extract = (level: "h2" | "h3" | "h4") => {
      const html = renderToString(<SectionHeader as={level}>x</SectionHeader>);
      const dom = new JSDOM(html);
      return dom.window.document.querySelector(level)?.className ?? "";
    };
    const h2 = extract("h2");
    const h3 = extract("h3");
    const h4 = extract("h4");
    expect(h2).not.toBe(h3);
    expect(h3).not.toBe(h4);
    expect(h2).not.toBe(h4);
  });
});
