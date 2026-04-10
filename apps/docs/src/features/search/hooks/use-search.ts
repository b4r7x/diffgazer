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

export function useSearch() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const generation = useRef(0)

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }

    const id = ++generation.current

    doSearch({ data: query })
      .then((items) => {
        if (id !== generation.current) return

        setResults(
          items.flatMap((item) => {
            const library = parseLibraryFromUrl(item.url)
            if (!library) return []

            const routeSlugs = routeSlugsFromSourcePath(library, item.url)
            if (!routeSlugs) return []

            const url = docsPath(library, routeSlugs)
            return [{
              id: item.id,
              url,
              title: stripMarkTags(
                item.type === "page"
                  ? item.content
                  : (item.breadcrumbs[item.breadcrumbs.length - 1] ?? item.content)
              ),
              excerpt: item.type !== "page" ? stripMarkTags(item.content) : "",
              section: url.match(/^\/[^/]+\/docs\/([^/]+)/)?.[1] ?? "general",
              library,
            }]
          }),
        )
      })
      .catch((err) => {
        if (id !== generation.current) return
        if (import.meta.env.DEV) console.warn("Search failed:", err)
        setResults([])
      })
  }, [query])

  const reset = () => {
    setQuery("")
    setResults([])
  }

  return { query, results, search: setQuery, reset }
}
