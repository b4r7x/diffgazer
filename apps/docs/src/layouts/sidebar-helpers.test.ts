import { describe, expect, it } from "vitest";
import { isIndentedItem } from "./sidebar";

describe("sidebar indentation", () => {
  it("indents nested integration and CLI command pages", () => {
    expect(isIndentedItem("/ui/docs/integrations/keys-usekey")).toBe(
      true,
    );
    expect(isIndentedItem("/ui/docs/cli/diff")).toBe(true);
    expect(isIndentedItem("/ui/docs/cli/remove")).toBe(true);
    expect(isIndentedItem("/ui/docs/cli")).toBe(false);
  });
});
