import { renderToString } from "react-dom/server";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { SectionHeader } from "./index.js";

describe("SectionHeader SSR", () => {
  it("server-renders the requested heading element", () => {
    const html = renderToString(<SectionHeader as="h2">Details</SectionHeader>);
    const dom = new JSDOM(html);

    const heading = dom.window.document.querySelector("h2");
    expect(heading?.tagName).toBe("H2");
    expect(heading?.textContent).toBe("Details");
  });
});
