import { describe, expect, it } from "vitest"
import { mapPageTreeForLibrary, type PageTree } from "@/lib/docs-tree"

const SOURCE_TREE: PageTree = {
  name: "Documentation",
  children: [
    {
      type: "folder",
      name: "ui",
      url: "/docs/ui",
      children: [
        {
          type: "separator",
          name: "---Getting Started---",
        },
        {
          type: "page",
          name: "installation",
          url: "/docs/ui/getting-started/installation",
        },
      ],
    },
    {
      type: "folder",
      name: "keys",
      url: "/docs/keys",
      children: [
        {
          type: "separator",
          name: "---Guides---",
        },
        {
          type: "page",
          name: "navigation",
          url: "/docs/keys/guides/navigation",
        },
      ],
    },
  ],
}

describe("mapPageTreeForLibrary", () => {
  it("keeps only active library nodes and rewrites urls", () => {
    const uiTree = mapPageTreeForLibrary(SOURCE_TREE, "ui")
    expect(uiTree.children).toHaveLength(1)
    expect(uiTree.children[0]).toEqual({
      type: "page",
      name: "installation",
      url: "/ui/docs/getting-started/installation",
    })

    const keysTree = mapPageTreeForLibrary(SOURCE_TREE, "keys")
    expect(keysTree.children).toHaveLength(1)
    expect(keysTree.children[0]).toEqual({
      type: "page",
      name: "navigation",
      url: "/keys/docs/guides/navigation",
    })
  })
})
