import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SectionHeader } from "./index.js";

describe("SectionHeader SSR", () => {
  it("server-renders the requested heading element", () => {
    const html = renderToString(<SectionHeader as="h2">Details</SectionHeader>);

    expect(html).toContain("<h2");
    expect(html).toContain("Details");
  });
});
