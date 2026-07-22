import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { compileFunction } from "node:vm";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axeCore from "axe-core";
import { createElement, useEffect, useId, useRef, useState } from "react";
import * as jsxRuntime from "react/jsx-runtime";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { isFocusable } from "../../dom/focusable.js";
import { KeyboardProvider } from "../../providers/keyboard.js";
import { useFocusRestore } from "../use-focus-restore.js";
import { useFocusTrap } from "../use-focus-trap.js";
import { useFocusZone } from "../use-focus-zone.js";
import { useKey } from "../use-key.js";
import { useScope } from "../use-scope.js";
import { useScrollLock } from "../use-scroll-lock.js";

const providerError = "useKeyboardContext must be used within KeyboardProvider";
const guideDirectory = resolve(process.cwd(), "docs/content/guides");

const recipeDependencies = {
  react: { createElement, useEffect, useId, useRef, useState },
  "react/jsx-runtime": jsxRuntime,
  "@diffgazer/keys": {
    KeyboardProvider,
    useFocusRestore,
    useFocusTrap,
    useFocusZone,
    useKey,
    useScope,
    useScrollLock,
  },
} satisfies Readonly<Record<string, unknown>>;

function extractGuideRecipe(fileName: string, heading: string): string {
  const source = readFileSync(resolve(guideDirectory, fileName), "utf8").replaceAll("\r\n", "\n");
  const headingMarker = `\n${heading}\n`;
  const headingStart = source.indexOf(headingMarker);
  if (headingStart === -1) throw new Error(`Missing guide heading: ${heading}`);

  const section = source.slice(headingStart + headingMarker.length);
  const fenceMarker = "```tsx\n";
  const fenceStart = section.indexOf(fenceMarker);
  if (fenceStart === -1) throw new Error(`Missing TSX recipe after: ${heading}`);

  const codeStart = fenceStart + fenceMarker.length;
  const fenceEnd = section.indexOf("\n```", codeStart);
  if (fenceEnd === -1) throw new Error(`Unclosed TSX recipe after: ${heading}`);
  return section.slice(codeStart, fenceEnd);
}

function requireRecipeDependency(specifier: string): unknown {
  switch (specifier) {
    case "react":
      return recipeDependencies.react;
    case "react/jsx-runtime":
      return recipeDependencies["react/jsx-runtime"];
    case "@diffgazer/keys":
      return recipeDependencies["@diffgazer/keys"];
    default:
      throw new Error(`Unexpected guide dependency: ${specifier}`);
  }
}

function compileGuideRecipe({
  fileName,
  heading,
  adapter,
  globals = {},
}: {
  fileName: string;
  heading: string;
  adapter: string;
  globals?: Readonly<Record<string, unknown>>;
}): Record<string, unknown> {
  const source = `${extractGuideRecipe(fileName, heading)}\n${adapter}`;
  const result = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: `${fileName}.tsx`,
    reportDiagnostics: true,
  });
  const errors = (result.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  if (errors.length > 0) {
    const messages = errors.map((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
    );
    throw new Error(messages.join("\n"));
  }

  const recipeExports: Record<string, unknown> = {};
  const recipeModule = { exports: recipeExports };
  const globalEntries = Object.entries(globals);
  const execute = compileFunction(result.outputText, [
    "require",
    "module",
    "exports",
    "__render",
    ...globalEntries.map(([name]) => name),
  ]);
  Reflect.apply(execute, undefined, [
    requireRecipeDependency,
    recipeModule,
    recipeExports,
    render,
    ...globalEntries.map(([, value]) => value),
  ]);
  return recipeExports;
}

function runRecipeExport(recipe: Record<string, unknown>, exportName: string): void {
  const run = recipe[exportName];
  if (typeof run !== "function") throw new Error(`Missing recipe export: ${exportName}`);
  Reflect.apply(run, undefined, []);
}

function createGuidePanel(label: string) {
  return function GuidePanel({ active }: { active: boolean }) {
    return createElement("output", { "aria-label": label }, active ? "active" : "inactive");
  };
}

describe("useFocusZone", () => {
  describe("published guide recipes", () => {
    it("runs the published focus-zone recipe only at its documented provider boundary", async () => {
      const user = userEvent.setup();
      const openFile = vi.fn();
      const recipe = compileGuideRecipe({
        fileName: "focus-zones.mdx",
        heading: "## Basic setup",
        adapter: `
          export function renderWithoutProvider() {
            return __render(<ThreePanelLayout />);
          }

          export function renderPublishedGuide() {
            return __render(<App />);
          }
        `,
        globals: {
          Sidebar: createGuidePanel("Sidebar guide zone"),
          Content: createGuidePanel("Content guide zone"),
          Preview: createGuidePanel("Preview guide zone"),
          openFile,
          editLine: vi.fn(),
          runPreview: vi.fn(),
        },
      });

      expect(() => runRecipeExport(recipe, "renderWithoutProvider")).toThrow(providerError);
      cleanup();

      runRecipeExport(recipe, "renderPublishedGuide");
      expect(screen.getByLabelText("Sidebar guide zone").textContent).toBe("active");

      await user.keyboard("{Enter}");
      expect(openFile).toHaveBeenCalledOnce();

      await user.keyboard("{ArrowRight}");
      expect(screen.getByLabelText("Content guide zone").textContent).toBe("active");
    });

    it("runs the published modal recipe only at its documented provider boundary", async () => {
      const user = userEvent.setup();
      const recipe = compileGuideRecipe({
        fileName: "focus-and-scroll.mdx",
        heading: "### The modal pattern",
        adapter: `
          export function renderWithoutProvider() {
            return __render(<Modal open={false} onClose={() => undefined} />);
          }

          export function renderPublishedGuide() {
            return __render(<App />);
          }
        `,
      });

      expect(() => runRecipeExport(recipe, "renderWithoutProvider")).toThrow(providerError);
      cleanup();

      runRecipeExport(recipe, "renderPublishedGuide");
      const openButton = screen.getByRole("button", { name: "Open modal" });
      await user.click(openButton);

      const dialog = screen.getByRole("dialog", { name: "Modal title" });
      expect(dialog.getAttribute("aria-modal")).toBe("true");
      const axeResult = await axeCore.run(dialog);
      expect(axeResult.violations).toEqual([]);
      expect(openButton.closest("[inert]")).not.toBeNull();
      expect(isFocusable(openButton)).toBe(false);
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close" }));

      await user.keyboard("{Escape}");
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(openButton.closest("[inert]")).toBeNull();
      expect(isFocusable(openButton)).toBe(true);
      expect(document.activeElement).toBe(openButton);
    });

    it("restores focus to the published focus-restore panel's original trigger", async () => {
      const user = userEvent.setup();
      const recipe = compileGuideRecipe({
        fileName: "focus-and-scroll.mdx",
        heading: "## useFocusRestore",
        adapter: `
          export function renderPublishedGuide() {
            return __render(<TemporaryPanel />);
          }
        `,
      });

      runRecipeExport(recipe, "renderPublishedGuide");
      const openButton = screen.getByRole("button", { name: "Open panel" });
      const panelId = openButton.getAttribute("aria-controls");
      expect(panelId).not.toBeNull();
      expect(openButton.getAttribute("aria-expanded")).toBe("false");
      for (let cycle = 0; cycle < 2; cycle += 1) {
        await user.click(openButton);

        const dialog = screen.getByRole("dialog", { name: "Temporary panel" });
        expect(openButton.getAttribute("aria-expanded")).toBe("true");
        expect(dialog.id).toBe(panelId);
        expect(document.activeElement).toBe(dialog);

        await user.click(screen.getByRole("button", { name: "Close" }));
        const restoredOpenButton = screen.getByRole("button", { name: "Open panel" });
        expect(restoredOpenButton).toBe(openButton);
        expect(openButton.isConnected).toBe(true);
        expect(openButton.getAttribute("aria-expanded")).toBe("false");
        expect(document.activeElement).toBe(openButton);
      }
    });
  });
});
