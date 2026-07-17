import { describe, expect, it } from "vitest";
import { accordionDoc } from "./accordion";

describe("accordionDoc", () => {
  it("describes non-collapsible single mode without promising an initial selection", () => {
    const note = accordionDoc.notes?.find(({ title }) => title === "Collapsible")?.content;

    expect(note).toContain("may still initialize with no open item");
    expect(note).toContain("activating it again cannot close it");
    expect(note).not.toContain("always keep one item open");
  });
});
