import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { useActiveHeading } from "../use-active-heading";

// Runs in the "ssr" vitest project (node environment, no jsdom), so `document`
// and `window` are undefined here. F005: the hook must not read browser globals
// during render.

function Toc() {
  const { activeId } = useActiveHeading({ ids: ["intro", "usage"] });
  return <span data-testid="active">{activeId}</span>;
}

describe("useActiveHeading SSR", () => {
  it("renders without reading browser globals during render", () => {
    expect(typeof document).toBe("undefined");
    const html = renderToString(<Toc />);
    expect(html).toContain("intro");
  });

  it("seeds activeId from the first id before any effect runs", () => {
    function FirstId() {
      const { activeId } = useActiveHeading({ ids: ["a", "b", "c"] });
      return <>{activeId}</>;
    }
    expect(renderToString(<FirstId />)).toContain("a");
  });
});
