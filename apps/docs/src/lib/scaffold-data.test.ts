import { describe, expect, it } from "vitest";
import type { ComponentPageData } from "@/components/docs-mdx/doc-data-context";
import { PUBLISH_GATED } from "@/lib/consumption-metadata";
import { prepareComponentScaffoldData } from "@/lib/scaffold-data";

const componentData = {
  name: "button",
  title: "Button",
  description: "",
  dependencies: [],
  files: [],
  props: {},
  usageSnippet: "",
  usageSnippetHighlighted: [],
  examples: [],
  exampleSource: {},
  docs: null,
} satisfies ComponentPageData;

function installationPath(label: string) {
  const scaffold = prepareComponentScaffoldData("ui", componentData);
  const path = scaffold.installation.paths.find((entry) => entry.label === label);
  if (!path) throw new Error(`Missing installation path: ${label}`);
  return path;
}

describe("prepareInstallation", () => {
  it("states where dgadd writes the file, independently of the hosted-registry gate", () => {
    expect(installationPath("dgadd").details).toContainEqual({
      label: "Installs to",
      value: "src/components/ui/button",
    });
  });

  it("withholds the shadcn destination while the hosted registry is gated", () => {
    const copiesTo = installationPath("shadcn CLI").details.find(
      (detail) => detail.label === "Copies to",
    );

    expect(copiesTo).toEqual(
      PUBLISH_GATED ? undefined : { label: "Copies to", value: "src/components/ui/button" },
    );
  });
});
