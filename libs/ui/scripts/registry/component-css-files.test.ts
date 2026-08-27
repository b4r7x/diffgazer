import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { collectComponentCssFiles } from "./component-css-files.js";

describe("collectComponentCssFiles", () => {
  it("deduplicates normalized CSS paths in the package aggregation", () => {
    const sharedFile = { path: "registry/ui/shared/stepper.css", type: "registry:style" };

    const paths = collectComponentCssFiles(
      [
        { type: "registry:ui", files: [sharedFile] },
        {
          type: "registry:ui",
          files: [{ ...sharedFile, path: "registry/ui/stepper/../shared/stepper.css" }],
        },
      ],
      tmpdir(),
    );

    expect(paths).toEqual([sharedFile.path]);
  });
});
