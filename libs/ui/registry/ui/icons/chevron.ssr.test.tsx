import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Chevron } from "./index.js";

describe("Chevron SSR", () => {
  it("server-renders svg props and rotation", () => {
    const html = renderToString(<Chevron direction="down" data-icon="chevron" />);

    expect(html).toContain("<svg");
    expect(html).toContain('data-icon="chevron"');
    expect(html).toContain("rotate(90deg)");
  });
});
