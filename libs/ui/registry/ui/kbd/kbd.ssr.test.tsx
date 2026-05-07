import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Kbd } from "./index.js";

describe("Kbd SSR", () => {
  it("server-renders keyboard shortcut text", () => {
    const html = renderToString(<Kbd>Esc</Kbd>);

    expect(html).toContain("<kbd");
    expect(html).toContain("Esc");
  });
});
