import { useState, useRef, useEffect } from "react"
import { createServerFn } from "@tanstack/react-start"
import { searchAPI } from "@/lib/search-server"
import {
  docsPath,
  isDocsLibraryId,
  routeSlugsFromSourcePath,
  SOURCE_DOCS_PREFIX,
  type DocsLibraryId,
} from "@/lib/docs-library"

export interface SearchResult {
  id: string
  url: string
  title: string
  excerpt: string
  section: string
  library: string
}

export type SearchStatus = "idle" | "loading" | "success" | "empty" | "error"

type SearchState =
  | { status: "idle"; results: []; error: null }
  | { status: "loading"; results: []; error: null }
  | { status: "success"; results: SearchResult[]; error: null }
  | { status: "empty"; results: []; error: null }
  | { status: "error"; results: []; error: string }

interface ServerSearchResult {
  id: string
  url: string
  type: string
  content: string
  breadcrumbs: string[]
}

const doSearch = createServerFn({ method: "GET" })
  .inputValidator((query: string) => query)
  .handler(async ({ data: query }): Promise<ServerSearchResult[]> => {
    const results = await searchAPI.search(query)
    return results.slice(0, 16).map((result) => ({
      id: result.id,
      url: result.url,
      type: result.type,
      content: typeof result.content === "string" ? result.content : "",
      breadcrumbs: result.breadcrumbs ?? [],
    }))
  })

function stripMarkTags(html: string): string {
  return html.replace(/<\/?mark>/g, "")
}

function parseLibraryFromUrl(url: string): DocsLibraryId | null {
  if (!url.startsWith(SOURCE_DOCS_PREFIX)) return null
  const rest = url.slice(SOURCE_DOCS_PREFIX.length)
  const lib = rest.split("/")[0]
  return lib && isDocsLibraryId(lib) ? lib : null
}

function toSearchResult(item: ServerSearchResult): SearchResult | null {
  const library = parseLibraryFromUrl(item.url)
  if (!library) return null

  const routeSlugs = routeSlugsFromSourcePath(library, item.url)
  if (!routeSlugs) return null

  const url = docsPath(library, routeSlugs)
  return {
    id: item.id,
    url,
    title: stripMarkTags(
      item.type === "page"
        ? item.content
        : (item.breadcrumbs[item.breadcrumbs.length - 1] ?? item.content),
    ),
    excerpt: item.type !== "page" ? stripMarkTags(item.content) : "",
    section: url.match(/^\/[^/]+\/docs\/([^/]+)/)?.[1] ?? "general",
    library,
  }
}

const SEARCH_IDLE_STATE: SearchState = { status: "idle", results: [], error: null }
const SEARCH_LOADING_STATE: SearchState = { status: "loading", results: [], error: null }
const SEARCH_ERROR_MESSAGE = "Search failed. Try again."

function toSearchResults(items: ServerSearchResult[]): SearchResult[] {
  return items.flatMap((item) => {
    const result = toSearchResult(item)
    return result ? [result] : []
  })
}

function toResolvedSearchState(results: SearchResult[]): SearchState {
  return results.length > 0
    ? { status: "success", results, error: null }
    : { status: "empty", results: [], error: null }
}

export function useSearch() {
  const [query, setQuery] = useState("")
  const [searchState, setSearchState] = useState<SearchState>(SEARCH_IDLE_STATE)
  const generation = useRef(0)

  useEffect(() => {
    const trimmedQuery = query.trim()

    if (!trimmedQuery) {
      setSearchState(SEARCH_IDLE_STATE)
      return
    }

    setSearchState(SEARCH_LOADING_STATE)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      const id = ++generation.current

      doSearch({ data: trimmedQuery, signal: controller.signal })
        .then((items) => {
          if (id !== generation.current || controller.signal.aborted) return

          setSearchState(toResolvedSearchState(toSearchResults(items)))
        })
        .catch((err) => {
          if (id !== generation.current || controller.signal.aborted) return
          if (import.meta.env.DEV) console.warn("Search failed:", err)
          setSearchState({ status: "error", results: [], error: SEARCH_ERROR_MESSAGE })
        })
    }, 150)

    return () => {
      clearTimeout(timeoutId)
      controller.abort()
    }
  }, [query])

  return { query, ...searchState, search: setQuery }
}
