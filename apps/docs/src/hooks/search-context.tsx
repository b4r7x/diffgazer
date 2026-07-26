import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";

/** A docs page the reader opened during this browser session. */
export interface RecentDocsPage {
  title: string;
  url: string;
  section: string;
}

/** Section indexes of the library that owns the current route. */
export interface DocsSearchScope {
  library: string;
  sections: { name: string; url: string }[];
}

const RECENT_STORAGE_KEY = "@diffgazer/docs-recent";
const RECENT_LIMIT = 4;

interface SearchContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  recent: RecentDocsPage[];
  recordVisit: (page: RecentDocsPage) => void;
  scope: DocsSearchScope | null;
  setScope: (scope: DocsSearchScope | null) => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

function isRecentPage(value: unknown): value is RecentDocsPage {
  if (typeof value !== "object" || value === null) return false;
  const page = value as Partial<RecentDocsPage>;
  return (
    typeof page.title === "string" &&
    typeof page.url === "string" &&
    typeof page.section === "string"
  );
}

function readRecent(): RecentDocsPage[] {
  try {
    const raw = sessionStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isRecentPage).slice(0, RECENT_LIMIT) : [];
  } catch {
    // Locked-down browsers throw on storage access; the launcher then simply
    // opens without a Recent group.
    return [];
  }
}

function writeRecent(pages: RecentDocsPage[]): void {
  try {
    sessionStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(pages));
  } catch {
    // Same: the in-memory list still serves this page view.
  }
}

export function SearchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<RecentDocsPage[]>([]);
  const [scope, setScope] = useState<DocsSearchScope | null>(null);

  // sessionStorage is a client-only external store, so the server renders no
  // recents and the client adopts them after hydration.
  useEffect(() => {
    const stored = readRecent();
    if (stored.length > 0) setRecent(stored);
  }, []);

  const recordVisit = useCallback((page: RecentDocsPage) => {
    setRecent((current) => {
      const next = [page, ...current.filter((entry) => entry.url !== page.url)].slice(
        0,
        RECENT_LIMIT,
      );
      writeRecent(next);
      return next;
    });
  }, []);

  return (
    <SearchContext value={{ open, setOpen, recent, recordVisit, scope, setScope }}>
      {children}
    </SearchContext>
  );
}

function useSearchContext(): SearchContextValue {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error("useSearchOpen must be used within SearchProvider");
  return ctx;
}

export function useSearchOpen() {
  return useSearchContext();
}

/** Pages visited this session, most recent first, and the recorder for new visits. */
export function useDocsHistory() {
  const { recent, recordVisit } = useSearchContext();
  return { recent, recordVisit };
}

/** Section indexes for the library that owns the current route, and its setter. */
export function useDocsSearchScope() {
  const { scope, setScope } = useSearchContext();
  return { scope, setScope };
}
