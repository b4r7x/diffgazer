import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button SSR", () => {
  it("renders stable markup on the server", () => {
    const html = renderToString(<Button>Save</Button>);

    expect(html).toContain("Save");
    expect(html).toContain("button");
  });
});
