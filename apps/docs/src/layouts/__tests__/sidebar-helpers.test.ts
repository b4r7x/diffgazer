import { describe, expect, it } from "vitest"
import { isIndentedItem, filterTreeByLibrary } from "@/layouts/sidebar"
import { inferDocsLibraryFromPath } from "@/lib/docs-library"

describe("sidebar indentation", () => {
  it("indents nested integration and CLI command pages", () => {
    expect(isIndentedItem("/docs/integrations/keyscope-usekey")).toBe(true)
    expect(isIndentedItem("/docs/cli/diff")).toBe(true)
    expect(isIndentedItem("/docs/cli/remove")).toBe(true)
    expect(isIndentedItem("/docs/cli")).toBe(false)
  })
})

describe("docs library context", () => {
  it("infers active docs library from pathname", () => {
    expect(inferDocsLibraryFromPath("/docs/keyscope/api")).toBe("keyscope")
    expect(inferDocsLibraryFromPath("/docs/components/button")).toBe("diff-ui")
  })
})

describe("sidebar filtering", () => {
  it("keeps only keyscope pages in keyscope mode", () => {
    const filtered = filterTreeByLibrary(
      {
        name: "Documentation",
        children: [
          { type: "page", name: "Getting Started", url: "/docs/getting-started/installation" },
          {
            type: "folder",
            name: "Keyscope",
            children: [
              { type: "page", name: "API", url: "/docs/keyscope/api" },
            ],
          },
        ],
      },
      "keyscope",
    )

    expect(filtered.children).toEqual([
      {
        type: "folder",
        name: "Keyscope",
        children: [{ type: "page", name: "API", url: "/docs/keyscope/api" }],
      },
    ])
  })
})
