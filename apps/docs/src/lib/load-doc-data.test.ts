import { describe, expect, it } from "vitest"
import { loadDocData } from "./load-doc-data"

describe("loadDocData", () => {
  it("treats missing component metadata as optional until component JSON is generated", async () => {
    await expect(loadDocData("ui", "components", "missing-component-metadata")).resolves.toBeNull()
  })

  it("still loads generated hook metadata", async () => {
    await expect(loadDocData("ui", "hooks", "controllable-state")).resolves.toMatchObject({
      name: "controllable-state",
    })
  })
})
