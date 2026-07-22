import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType } from "react";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { JsxEmit, ModuleKind, ScriptTarget, transpileModule } from "typescript";
import { describe, expect, it } from "vitest";
import { useNavigationDoc } from "../../../docs/hook-docs/use-navigation.js";
import { useScopedNavigationDoc } from "../../../docs/hook-docs/use-scoped-navigation.js";
import { useNavigation } from "../use-navigation.js";

function loadNavigationGuideExample(): ComponentType {
  const guide = readFileSync(join(process.cwd(), "docs/content/guides/navigation.mdx"), "utf8");
  const source = guide.match(/### DOM setup[\s\S]*?```tsx\n([\s\S]*?)\n```/)?.[1];
  if (!source) throw new Error("Navigation guide DOM setup example is missing");

  const exportableSource = source.replace("function FileList()", "export function FileList()");
  if (exportableSource === source) throw new Error("Navigation guide FileList example is missing");

  const { outputText } = transpileModule(exportableSource, {
    compilerOptions: {
      jsx: JsxEmit.ReactJSX,
      module: ModuleKind.CommonJS,
      target: ScriptTarget.ES2022,
    },
  });
  const exports: { FileList?: ComponentType } = {};
  const requireModule = (specifier: string) => {
    if (specifier === "@diffgazer/keys") return { useNavigation };
    if (specifier === "react") return React;
    if (specifier === "react/jsx-runtime") return jsxRuntime;
    throw new Error(`Unexpected guide import: ${specifier}`);
  };
  runInNewContext(outputText, { console, exports, require: requireModule });
  if (!exports.FileList) throw new Error("Navigation guide did not export FileList");
  return exports.FileList;
}

describe("useNavigation", () => {
  describe("guide and contract", () => {
    it("keeps standalone and scoped activation callback metadata aligned", () => {
      const parameterDescriptions = (name: "onSelect" | "onEnter") =>
        [useNavigationDoc, useScopedNavigationDoc].map((doc) => {
          if (!doc.parameters) throw new Error("Navigation callback metadata is missing");
          return doc.parameters.find((parameter) => parameter.name === name)?.description;
        });
      const onSelectDescriptions = parameterDescriptions("onSelect");
      const onEnterDescriptions = parameterDescriptions("onEnter");

      expect(onSelectDescriptions).toEqual([onSelectDescriptions[0], onSelectDescriptions[0]]);
      expect(onSelectDescriptions[0]).toBe(
        "Called when Space selects the highlighted item, and as the Enter fallback when onEnter is not provided.",
      );
      expect(onEnterDescriptions).toEqual([onEnterDescriptions[0], onEnterDescriptions[0]]);
      expect(onEnterDescriptions[0]).toBe(
        "Called when Enter is pressed on the highlighted item. When provided, it overrides the onSelect Enter fallback.",
      );
    });

    it("executes the actual guide listbox fence through Tab and ArrowDown", async () => {
      const NavigationGuideListbox = loadNavigationGuideExample();
      const user = userEvent.setup();
      render(
        <>
          <NavigationGuideListbox />
          <button type="button">After</button>
        </>,
      );

      await user.tab();
      const listbox = screen.getByRole("listbox", { name: "Project files" });
      expect(document.activeElement).toBe(listbox);
      expect(listbox.getAttribute("aria-activedescendant")).toBe("file-source");

      await user.keyboard("{ArrowDown}");

      expect(document.activeElement).toBe(listbox);
      expect(listbox.getAttribute("aria-activedescendant")).toBe("file-tests");
      expect(screen.getByRole("option", { name: "Tests" }).getAttribute("aria-selected")).toBe(
        "true",
      );

      await user.tab();
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "After" }));
    });
  });
});
