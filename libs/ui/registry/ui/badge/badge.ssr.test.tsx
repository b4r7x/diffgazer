import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Badge } from "./index.js";

describe("Badge SSR", () => {
  it("renders static badge markup on the server", () => {
    const html = renderToString(<Badge variant="success">Ready</Badge>);

    expect(html).toContain("Ready");
    expect(html).toContain("span");
  });
});
