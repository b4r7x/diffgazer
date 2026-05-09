import { describe, expect, it } from "vitest"
import { loadDocData } from "./load-doc-data"

describe("loadDocData", () => {
  it("ignores unsafe metadata names", async () => {
    await expect(loadDocData("ui", "components", "../button")).resolves.toBeNull()
  })

  it("loads generated hook metadata", async () => {
    await expect(loadDocData("ui", "hooks", "controllable-state")).resolves.toMatchObject({
      name: "controllable-state",
      title: "Controllable State",
    })
  })

  it("treats missing component metadata as optional until component JSON is generated", async () => {
    await expect(loadDocData("ui", "components", "missing-component-metadata")).resolves.toBeNull()
  })
})
