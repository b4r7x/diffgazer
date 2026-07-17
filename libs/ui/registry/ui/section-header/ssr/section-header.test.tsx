import { JSDOM } from "jsdom";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SectionHeader } from "../index";

describe("SectionHeader SSR", () => {
  it("server-renders the requested heading element", () => {
    const html = renderToString(<SectionHeader as="h2">Details</SectionHeader>);
    const dom = new JSDOM(html);

    // querySelector retained: SSR-string parsed by JSDOM; RTL screen/getByRole is not available against a detached jsdom document — direct DOM access is the only path
    const heading = dom.window.document.querySelector("h2");
    expect(heading?.tagName).toBe("H2");
    expect(heading?.textContent).toBe("Details");
  });
});
