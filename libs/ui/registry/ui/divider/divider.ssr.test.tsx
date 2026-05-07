import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Divider } from "./index.js";

describe("Divider SSR", () => {
  it("renders static separator markup on the server", () => {
    const html = renderToString(
      <Divider decorative={false} variant="spaced">
        Section
      </Divider>,
    );

    expect(html).toContain("Section");
    expect(html).toContain('role="separator"');
  });
});
