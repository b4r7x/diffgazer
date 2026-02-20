import { useState, useRef, useEffect, useCallback } from "react"
import { createServerFn } from "@tanstack/react-start"
import { searchAPI } from "@/lib/search-server"

export interface SearchResult {
  id: string
  url: string
  title: string
  excerpt: string
  section: string
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
    return results.slice(0, 8).map((result) => ({
      id: result.id,
      url: result.url,
      type: result.type,
      content: typeof result.content === "string" ? result.content : "",
      breadcrumbs: result.breadcrumbs ?? [],
    }))
  })

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
          items.map((item) => ({
            id: item.id,
            url: item.url,
            title:
              item.type === "page"
                ? item.content
                : (item.breadcrumbs[item.breadcrumbs.length - 1] ?? item.content),
            excerpt: item.type !== "page" ? item.content : "",
            section: item.url.match(/^\/docs\/([^/]+)/)?.[1] ?? "general",
          })),
        )
      })
      .catch((err) => {
        if (id !== generation.current) return
        if (import.meta.env.DEV) console.warn("Search failed:", err)
        setResults([])
      })
  }, [query])

  const reset = useCallback(() => {
    setQuery("")
    setResults([])
  }, [])

  return { query, results, search: setQuery, reset }
}
