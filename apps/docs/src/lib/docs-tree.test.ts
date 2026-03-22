import { describe, expect, it } from "vitest"
import { mapPageTreeForLibrary, type PageTree } from "@/lib/docs-tree"

const SOURCE_TREE: PageTree = {
  name: "Documentation",
  children: [
    {
      type: "folder",
      name: "diff-ui",
      url: "/docs/diff-ui",
      children: [
        {
          type: "separator",
          name: "---Getting Started---",
        },
        {
          type: "page",
          name: "installation",
          url: "/docs/diff-ui/getting-started/installation",
        },
      ],
    },
    {
      type: "folder",
      name: "keyscope",
      url: "/docs/keyscope",
      children: [
        {
          type: "separator",
          name: "---Guides---",
        },
        {
          type: "page",
          name: "navigation",
          url: "/docs/keyscope/guides/navigation",
        },
      ],
    },
  ],
}

describe("mapPageTreeForLibrary", () => {
  it("keeps only active library nodes and rewrites urls", () => {
    const diffUiTree = mapPageTreeForLibrary(SOURCE_TREE, "diff-ui")
    expect(diffUiTree.children).toHaveLength(1)
    expect(diffUiTree.children[0]).toEqual({
      type: "page",
      name: "installation",
      url: "/diff-ui/docs/getting-started/installation",
    })

    const keyscopeTree = mapPageTreeForLibrary(SOURCE_TREE, "keyscope")
    expect(keyscopeTree.children).toHaveLength(1)
    expect(keyscopeTree.children[0]).toEqual({
      type: "page",
      name: "navigation",
      url: "/keyscope/docs/guides/navigation",
    })
  })
})
