import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "../../../testing/axe";
import { CommandPaletteHighlightItem, categorize, matchPositions } from "./highlight";
import { CommandPalette } from "./index";

describe("CommandPaletteHighlightItem", () => {
  it("categorize maps verbs to tones", () => {
    expect(categorize("Delete branch")).toBe("destructive");
    expect(categorize("Go to History")).toBe("nav");
    expect(categorize("Toggle theme")).toBe("settings");
    expect(categorize("Ask the assistant")).toBe("ai");
    expect(categorize("Run tests")).toBe("action");
    expect(categorize("Random thing")).toBe("neutral");
  });

  it("categorize returns neutral for empty and whitespace-only input", () => {
    expect(categorize("")).toBe("neutral");
    expect(categorize("   ")).toBe("neutral");
  });

  it("matchPositions returns contiguous indices when substring present", () => {
    expect(matchPositions("Run tests", "tests")).toEqual([4, 5, 6, 7, 8]);
    expect(matchPositions("Run tests", "zzz")).toEqual([]);
  });

  it("matchPositions falls back to fuzzy non-contiguous indices", () => {
    expect(matchPositions("Hello World", "hwl")).toEqual([0, 6, 9]);
  });

  it("infers tone and wraps matched characters in <mark>", async () => {
    const { container } = render(
      <CommandPalette open search="del">
        <CommandPalette.Content>
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPaletteHighlightItem id="rm">Delete branch</CommandPaletteHighlightItem>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    );

    const item = await screen.findByRole("option", { name: /delete branch/i });
    expect(item).not.toHaveAttribute("aria-label");
    expect(item).toHaveAttribute("data-tone", "destructive");
    const marks = item.querySelectorAll('mark[data-slot="command-palette-item-match"]');
    expect(marks.length).toBe(3);
    expect(
      Array.from(marks)
        .map((m) => m.textContent)
        .join(""),
    ).toBe("Del");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("explicit tone overrides inferred destructive tone", () => {
    render(
      <CommandPalette open>
        <CommandPalette.Content>
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPaletteHighlightItem id="rm" tone="ai">
              Delete branch
            </CommandPaletteHighlightItem>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    );
    expect(screen.getByRole("option", { name: /delete branch/i })).toHaveAttribute(
      "data-tone",
      "ai",
    );
  });

  it("preserves non-text children when search is active (no silent content loss)", async () => {
    render(
      <CommandPalette open search="del">
        <CommandPalette.Content>
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPaletteHighlightItem id="rm" label="Delete branch">
              Delete <strong>branch</strong>
            </CommandPaletteHighlightItem>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    );

    const item = await screen.findByRole("option", { name: /delete branch/i });
    expect(item).toHaveAttribute("aria-label", "Delete branch");
    expect(item).toHaveAccessibleName("Delete branch");
    expect(item.querySelector("strong")).not.toBeNull();
    expect(item.querySelector("strong")?.textContent).toBe("branch");
  });

  it("falls back to id when rich children have no searchable label", async () => {
    render(
      <CommandPalette open search="delete-branch">
        <CommandPalette.Content>
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPaletteHighlightItem id="delete-branch">
              <span>Delete branch</span>
            </CommandPaletteHighlightItem>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    );

    expect(await screen.findByRole("option", { name: "Delete branch" })).toBeInTheDocument();
  });

  it("falls back to id without dropping icon-plus-text children", async () => {
    render(
      <CommandPalette open search="remove-branch">
        <CommandPalette.Content>
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPaletteHighlightItem id="remove-branch">
              <svg aria-hidden="true" data-testid="branch-icon" />
              Delete branch
            </CommandPaletteHighlightItem>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    );

    expect(await screen.findByRole("option", { name: "Delete branch" })).toBeInTheDocument();
    expect(screen.getByTestId("branch-icon")).toBeInTheDocument();
  });

  it("uses an explicit value to filter rich children", async () => {
    render(
      <CommandPalette open search="remove branch">
        <CommandPalette.Content>
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPaletteHighlightItem id="rm" value="remove branch">
              <span>Delete branch</span>
            </CommandPaletteHighlightItem>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    );

    expect(await screen.findByRole("option", { name: "Delete branch" })).toBeInTheDocument();
  });

  it("uses label as the accessible name for icon-only content", () => {
    render(
      <CommandPalette open>
        <CommandPalette.Content>
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPaletteHighlightItem id="rm" label="Delete branch">
              <svg aria-hidden="true" />
            </CommandPaletteHighlightItem>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    );

    const item = screen.getByRole("option", { name: "Delete branch" });
    expect(item).toHaveAttribute("aria-label", "Delete branch");
  });

  it("keeps an explicit accessible name ahead of the label fallback", () => {
    render(
      <CommandPalette open>
        <CommandPalette.Content>
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPaletteHighlightItem
              id="rm"
              label="Delete branch"
              aria-label="Delete the current branch"
            >
              <svg aria-hidden="true" />
            </CommandPaletteHighlightItem>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    );

    const item = screen.getByRole("option", { name: "Delete the current branch" });
    expect(item).toHaveAttribute("aria-label", "Delete the current branch");
  });
});
