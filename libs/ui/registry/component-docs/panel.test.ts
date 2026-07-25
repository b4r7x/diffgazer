import { describe, expect, it } from "vitest";
import { panelDoc } from "./panel";

describe("panelDoc", () => {
  it("documents every explicit ARIA name as an initial section trigger", () => {
    const asProp = panelDoc.props?.Panel?.as;

    expect(asProp?.defaultValue).toContain("explicit ARIA name");
    expect(asProp?.description).toContain("explicit ARIA name");
    expect(asProp?.defaultValue).not.toContain("aria-label present");
  });
});
