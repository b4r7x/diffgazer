import type { RegistryItem } from "@diffgazer/registry/schemas";
import { describe, expect, it } from "vitest";
import { transformUiPublicRegistrySourceItem } from "./public-registry-item.js";
import { createThemeStyleStripPolicy } from "./theme-style-dedupe.js";

describe("transformUiPublicRegistrySourceItem", () => {
  it("stamps nested diff targets onto the diff public item", () => {
    const item = transformUiPublicRegistrySourceItem({
      name: "diff",
      type: "registry:lib",
      dependencies: [],
      registryDependencies: [],
      files: [
        { path: "registry/lib/diff/index.ts", type: "registry:lib" },
        { path: "registry/lib/diff/parse.ts", type: "registry:lib" },
      ],
    });

    expect(item.files[0]?.target).toBe("@lib/diff/index.ts");
    expect(item.files[1]?.target).toBe("@lib/diff/parse.ts");
  });

  it("strips every non-theme CSS file from the shadcn source item shape", () => {
    const stylePolicy = createThemeStyleStripPolicy(
      [
        {
          name: "dialog",
          type: "registry:ui",
          dependencies: [],
          registryDependencies: ["dialog-shell", "theme"],
          files: [],
        },
        {
          name: "dialog-shell",
          type: "registry:ui",
          dependencies: [],
          registryDependencies: [],
          meta: { hidden: true },
          files: [],
        },
        {
          name: "theme",
          type: "registry:theme",
          dependencies: [],
          registryDependencies: [],
          files: [],
        },
      ],
      "/* dialog */",
    );
    const item = transformUiPublicRegistrySourceItem(
      {
        name: "dialog-shell",
        type: "registry:ui",
        dependencies: [],
        registryDependencies: [],
        files: [
          { path: "registry/ui/dialog/dialog.tsx", type: "registry:ui" },
          { path: "registry/ui/shared/dialog.css", type: "registry:style" },
          { path: "registry/ui/dialog/dialog.test.tsx", type: "registry:ui" },
        ],
      },
      {
        stylePolicy,
        readSourceFile: () => "/* dialog */",
      },
    );

    expect(item.files.map((file) => file.path)).toEqual([
      "registry/ui/dialog/dialog.tsx",
      "registry/ui/dialog/dialog.test.tsx",
    ]);

    const unique = transformUiPublicRegistrySourceItem(
      {
        name: "unique",
        type: "registry:ui",
        dependencies: [],
        registryDependencies: [],
        files: [{ path: "registry/ui/unique/unique.css", type: "registry:style" }],
      },
      { stylePolicy, readSourceFile: () => "/* unique */" },
    );
    expect(unique.files).toHaveLength(1);

    const unthemedPolicy = createThemeStyleStripPolicy(
      [
        {
          name: "unthemed",
          type: "registry:ui",
          dependencies: [],
          registryDependencies: [],
          files: [],
        },
      ],
      "/* unthemed */",
    );
    const unthemed = transformUiPublicRegistrySourceItem(
      {
        name: "unthemed",
        type: "registry:ui",
        dependencies: [],
        registryDependencies: [],
        files: [{ path: "registry/ui/unthemed/unthemed.css", type: "registry:style" }],
      },
      { stylePolicy: unthemedPolicy, readSourceFile: () => "/* unthemed */" },
    );
    expect(unthemed.files).toHaveLength(1);
  });

  it("keeps a shared CSS carrier when any visible owner does not use the theme", () => {
    const sharedPath = "registry/ui/shared/mixed.css";
    const sourceItems: RegistryItem[] = [
      {
        name: "themed",
        type: "registry:ui",
        dependencies: [],
        registryDependencies: ["shared-style", "theme"],
        files: [{ path: sharedPath, type: "registry:style" }],
      },
      {
        name: "unthemed",
        type: "registry:ui",
        dependencies: [],
        registryDependencies: ["shared-style"],
        files: [{ path: sharedPath, type: "registry:style" }],
      },
      {
        name: "shared-style",
        type: "registry:ui",
        dependencies: [],
        registryDependencies: [],
        meta: { hidden: true },
        files: [{ path: sharedPath, type: "registry:style" }],
      },
      {
        name: "theme",
        type: "registry:theme",
        dependencies: [],
        registryDependencies: [],
        files: [],
      },
    ];
    const [themed, unthemed, sharedStyle] = sourceItems;
    if (!themed || !unthemed || !sharedStyle) throw new Error("incomplete style fixture");
    const stylePolicy = createThemeStyleStripPolicy(sourceItems, "/* shared */");
    const readSourceFile = () => "/* shared */";

    expect(
      transformUiPublicRegistrySourceItem(themed, { stylePolicy, readSourceFile }).files,
    ).toHaveLength(0);
    expect(
      transformUiPublicRegistrySourceItem(unthemed, { stylePolicy, readSourceFile }).files,
    ).toHaveLength(1);
    expect(
      transformUiPublicRegistrySourceItem(sharedStyle, { stylePolicy, readSourceFile }).files,
    ).toHaveLength(1);
  });
});
