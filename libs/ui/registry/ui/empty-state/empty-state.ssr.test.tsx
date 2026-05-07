import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./index.js";

describe("EmptyState SSR", () => {
  it("server-renders the same live-region content available on first client render", () => {
    const html = renderToString(<EmptyState live>No results</EmptyState>);

    expect(html).toContain("No results");
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
  });
});
