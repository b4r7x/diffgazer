import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Panel } from "./index.js";

describe("Panel SSR", () => {
  it("renders composed panel markup on the server", () => {
    const html = renderToString(
      <Panel as="section" aria-label="Status">
        <Panel.Header>Build</Panel.Header>
        <Panel.Content>Ready</Panel.Content>
      </Panel>,
    );

    expect(html).toContain("Status");
    expect(html).toContain("Build");
    expect(html).toContain("Ready");
  });
});
