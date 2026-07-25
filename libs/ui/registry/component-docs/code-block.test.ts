import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";
import type { CodeBlock } from "../ui/code-block";
import { codeBlockDoc } from "./code-block";

const codeBlockLineProps = [
  "number",
  "content",
  "children",
  "state",
  "addedLineLabel",
  "removedLineLabel",
] as const satisfies readonly (keyof ComponentProps<typeof CodeBlock.Line>)[];

describe("codeBlockDoc", () => {
  it("keeps the curated CodeBlock.Line API table exact", () => {
    expect(Object.keys(codeBlockDoc.props?.CodeBlockLine ?? {})).toEqual([...codeBlockLineProps]);
  });
});
