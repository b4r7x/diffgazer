import { isNotFound, isRedirect } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";
import { Route } from "./index";

const serverBoundary = vi.hoisted(() => ({ splat: null as string | null }));

// Boundary mock: TanStack Start server functions cross the server/client boundary.
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const chain = {
      inputValidator: () => chain,
      handler: () => async () => serverBoundary.splat,
    };
    return chain;
  },
}));

type IndexRouteLoader = (context: { params: { lib: string } }) => Promise<unknown>;

function runLoader(lib: string) {
  const loader = Route.options.loader as unknown as IndexRouteLoader;
  return loader({ params: { lib } });
}

describe("$lib/ index route loader", () => {
  it("redirects to the resolved first page, replacing the history entry", async () => {
    serverBoundary.splat = "getting-started";

    const thrown = await runLoader("ui").catch((caught: unknown) => caught);

    expect(isRedirect(thrown)).toBe(true);
    const redirectOptions = (
      thrown as { options: { to: string; params: unknown; replace: boolean } }
    ).options;
    expect(redirectOptions.to).toBe("/$lib/$");
    expect(redirectOptions.params).toEqual({ lib: "ui", _splat: "getting-started" });
    expect(redirectOptions.replace).toBe(true);
  });

  // The empty-tree case: firstNavigablePage returns null when the scoped library
  // has no navigable page, which resolveFirstPageSplat surfaces as a null splat.
  it("throws not-found when the scoped library's tree has no navigable page", async () => {
    serverBoundary.splat = null;

    const thrown = await runLoader("ui").catch((caught: unknown) => caught);

    expect(isNotFound(thrown)).toBe(true);
  });
});
