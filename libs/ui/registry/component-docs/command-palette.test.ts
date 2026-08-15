import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";
import type { CommandPaletteInput } from "../ui/command-palette";
import { commandPaletteDoc } from "./command-palette";

const commandInputProps = [
  "label",
  "placeholder",
  "prefix",
  "suffix",
  "closeLabel",
] as const satisfies readonly (keyof ComponentProps<typeof CommandPaletteInput>)[];

describe("commandPaletteDoc", () => {
  it("keeps the curated CommandPaletteInput API table exact", () => {
    expect(Object.keys(commandPaletteDoc.props?.CommandPaletteInput ?? {})).toEqual([
      ...commandInputProps,
    ]);
  });

  it("documents filtering against the live search value, not a deferred one", () => {
    const filteringNote = commandPaletteDoc.notes?.find(
      (note) => note.title === "Built-in Filtering",
    );

    expect(filteringNote?.content).toContain("live search value");
    expect(filteringNote?.content).toContain("controlled `search` prop");
    expect(filteringNote?.content).not.toContain("deferred");
  });
});
