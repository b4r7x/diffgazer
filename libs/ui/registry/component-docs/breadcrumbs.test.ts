import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";
import type { Breadcrumbs } from "../ui/breadcrumbs";
import type { Callout } from "../ui/callout";
import type { CodeBlock } from "../ui/code-block";
import type { CommandPaletteInput } from "../ui/command-palette";
import { breadcrumbsDoc } from "./breadcrumbs";
import { calloutDoc } from "./callout";
import { codeBlockDoc } from "./code-block";
import { commandPaletteDoc } from "./command-palette";

const ellipsisProps = ["label", "children"] as const satisfies readonly (keyof ComponentProps<
  typeof Breadcrumbs.Ellipsis
>)[];
const calloutProps = [
  "tone",
  "frame",
  "open",
  "defaultOpen",
  "onOpenChange",
  "live",
  "toneLabel",
] as const satisfies readonly (keyof ComponentProps<typeof Callout>)[];
const codeBlockLineProps = [
  "number",
  "content",
  "children",
  "state",
  "addedLineLabel",
  "removedLineLabel",
] as const satisfies readonly (keyof ComponentProps<typeof CodeBlock.Line>)[];
const commandInputProps = [
  "label",
  "placeholder",
  "prefix",
  "suffix",
] as const satisfies readonly (keyof ComponentProps<typeof CommandPaletteInput>)[];

describe("accessibility localization metadata", () => {
  it("keeps each curated component-owned API table exact", () => {
    expect(Object.keys(breadcrumbsDoc.props?.["Breadcrumbs.Ellipsis"] ?? {})).toEqual([
      ...ellipsisProps,
    ]);
    expect(Object.keys(calloutDoc.props?.Callout ?? {})).toEqual([...calloutProps]);
    expect(Object.keys(codeBlockDoc.props?.CodeBlockLine ?? {})).toEqual([...codeBlockLineProps]);
    expect(Object.keys(commandPaletteDoc.props?.CommandPaletteInput ?? {})).toEqual([
      ...commandInputProps,
    ]);
  });
});
