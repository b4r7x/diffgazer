import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";
import type { Callout } from "../ui/callout";
import { calloutDoc } from "./callout";

const calloutProps = [
  "tone",
  "frame",
  "open",
  "defaultOpen",
  "onOpenChange",
  "live",
  "toneLabel",
] as const satisfies readonly (keyof ComponentProps<typeof Callout>)[];

describe("calloutDoc", () => {
  it("keeps the curated Callout API table exact", () => {
    expect(Object.keys(calloutDoc.props?.Callout ?? {})).toEqual([...calloutProps]);
  });
});
