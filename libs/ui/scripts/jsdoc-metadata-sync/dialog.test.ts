import { describe, expect, it } from "vitest";
import { dialogDoc } from "../../registry/component-docs/dialog";

describe("Dialog metadata JSDoc sync", () => {
  it("documents DialogClose accessible-name precedence and fallback", () => {
    expect(dialogDoc.props?.DialogClose?.["aria-label"]).toEqual({
      type: "string",
      required: false,
      defaultValue: null,
      description:
        'Explicit accessible name. aria-labelledby wins when both attributes are set. With neither attribute, visible child text names the button; empty, decorative, or hidden content falls back to "Close dialog".',
    });
    expect(dialogDoc.props?.DialogClose?.["aria-labelledby"]).toEqual({
      type: "string",
      required: false,
      defaultValue: null,
      description:
        'ID reference for an external label. It takes precedence over aria-label and suppresses the automatic "Close dialog" fallback.',
    });
  });
});
