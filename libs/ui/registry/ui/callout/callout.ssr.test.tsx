import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Callout } from "./index.js";

describe("Callout SSR", () => {
  it("server-renders content without live-region semantics by default", () => {
    const html = renderToString(<Callout variant="warning">Heads up</Callout>);

    expect(html).toContain("Heads up");
    expect(html).not.toContain('role="status"');
  });

  it("server-renders error callouts as alerts", () => {
    const html = renderToString(<Callout variant="error">Failed</Callout>);

    expect(html).toContain("Failed");
    expect(html).toContain('role="alert"');
  });
});
