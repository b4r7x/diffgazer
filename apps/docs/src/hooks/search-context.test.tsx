import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  type RecentDocsPage,
  SearchProvider,
  useDocsHistory,
  useSearchOpen,
} from "./search-context";

const RECENT_STORAGE_KEY = "@diffgazer/docs-recent";
/** Mirrors RECENT_LIMIT in search-context.tsx; the cap is the asserted contract. */
const RECENT_LIMIT = 4;

function recentPage(name: string): RecentDocsPage {
  return { title: name, url: `/ui/components/${name}`, section: "Components" };
}

describe("SearchProvider", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("provides open state that consumers can read and update", () => {
    const { result } = renderHook(() => useSearchOpen(), {
      wrapper: SearchProvider,
    });

    expect(result.current.open).toBe(false);

    act(() => result.current.setOpen(true));
    expect(result.current.open).toBe(true);

    act(() => result.current.setOpen(false));
    expect(result.current.open).toBe(false);
  });

  it("throws when used outside the provider", () => {
    expect(() => renderHook(() => useSearchOpen())).toThrow(/within SearchProvider/);
  });

  it("hydrates recents before child mount effects record a visit", async () => {
    const stored: RecentDocsPage[] = [
      { title: "Button", url: "/ui/components/button", section: "Components" },
      { title: "Callout", url: "/ui/components/callout", section: "Components" },
    ];
    sessionStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(stored));

    function RecordVisitOnMount() {
      const { recordVisit } = useDocsHistory();
      useEffect(() => {
        recordVisit({
          title: "Select",
          url: "/ui/components/select",
          section: "Components",
        });
      }, [recordVisit]);
      return null;
    }

    function RecentProbe() {
      const { recent } = useDocsHistory();
      return <output aria-label="Recent urls">{recent.map((page) => page.url).join("|")}</output>;
    }

    render(
      <SearchProvider>
        <RecentProbe />
        <RecordVisitOnMount />
      </SearchProvider>,
    );

    await waitFor(() =>
      expect(screen.getByRole("status", { name: "Recent urls" })).toHaveTextContent(
        "/ui/components/select|/ui/components/button|/ui/components/callout",
      ),
    );
    expect(JSON.parse(sessionStorage.getItem(RECENT_STORAGE_KEY) ?? "[]")).toEqual([
      {
        title: "Select",
        url: "/ui/components/select",
        section: "Components",
      },
      stored[0],
      stored[1],
    ]);
  });

  it("restores a previous session's pages and skips malformed stored entries", () => {
    sessionStorage.setItem(
      RECENT_STORAGE_KEY,
      JSON.stringify([recentPage("button"), { title: "Broken", url: 7 }, null, recentPage("card")]),
    );

    const { result } = renderHook(() => useDocsHistory(), { wrapper: SearchProvider });

    expect(result.current.recent).toEqual([recentPage("button"), recentPage("card")]);
  });

  it("keeps only the most recent pages up to the limit, without duplicates", () => {
    const { result } = renderHook(() => useDocsHistory(), { wrapper: SearchProvider });

    for (const name of ["a", "b", "c", "d", "e"]) {
      act(() => result.current.recordVisit(recentPage(name)));
    }
    act(() => result.current.recordVisit(recentPage("c")));

    expect(result.current.recent.map((page) => page.url)).toEqual([
      "/ui/components/c",
      "/ui/components/e",
      "/ui/components/d",
      "/ui/components/b",
    ]);
    expect(result.current.recent).toHaveLength(RECENT_LIMIT);
    expect(JSON.parse(sessionStorage.getItem(RECENT_STORAGE_KEY) ?? "[]")).toEqual(
      result.current.recent,
    );
  });
});
