import { describe, expect, it } from "vitest";
import { isIndentedItem } from "./sidebar";

describe("sidebar indentation", () => {
  it("indents nested integration and CLI command pages", () => {
    expect(isIndentedItem("/diff-ui/docs/integrations/keyscope-usekey")).toBe(
      true,
    );
    expect(isIndentedItem("/diff-ui/docs/cli/diff")).toBe(true);
    expect(isIndentedItem("/diff-ui/docs/cli/remove")).toBe(true);
    expect(isIndentedItem("/diff-ui/docs/cli")).toBe(false);
  });
});
