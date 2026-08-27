import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { axe } from "../../../testing/axe";
import { applyReducedMotionFixture } from "../../../testing/prefers-reduced-motion";
import { FOCUS_OUTLINE } from "../../lib/focus-outline";
import { Field } from "../field/index";
import { Select } from "./index";
import {
  getSearchInput,
  getSelectTrigger,
  PICK_FRUIT,
  renderSelect,
  renderSelectInline,
} from "./select-test-utils";

function stubTriggerRect(trigger: HTMLElement, top: number) {
  trigger.getBoundingClientRect = () =>
    ({
      x: 40,
      y: top,
      left: 40,
      top,
      right: 240,
      bottom: top + 32,
      width: 200,
      height: 32,
      toJSON: () => ({}),
    }) as DOMRect;
}

describe("Select active-descendant ownership", () => {
  it("makes the search input the editable combobox and reduces the trigger to a toggle when search is present", async () => {
    renderSelect({ withSearch: true, defaultOpen: true });
    const triggerButton = getSelectTrigger();
    const searchInput = getSearchInput();
    const listbox = screen.getByRole("listbox");
    const appleOption = screen.getByRole("option", { name: /apple/i });

    expect(screen.getAllByRole("combobox")).toEqual([searchInput]);
    expect(searchInput).toHaveAttribute("aria-controls", listbox.id);
    expect(searchInput).toHaveAttribute("aria-expanded", "true");
    expect(searchInput).toHaveAttribute("aria-autocomplete", "list");
    await waitFor(() => {
      expect(searchInput).toHaveAttribute("aria-activedescendant", appleOption.id);
      expect(listbox).not.toHaveAttribute("aria-activedescendant");
    });

    expect(triggerButton).not.toHaveAttribute("role", "combobox");
    expect(triggerButton).toHaveAttribute("aria-haspopup", "listbox");
    expect(triggerButton).toHaveAttribute("aria-expanded", "true");
    expect(triggerButton).not.toHaveAttribute("aria-controls");
    expect(triggerButton).not.toHaveAttribute("aria-activedescendant");
  });

  it("announces the first matching searchable option as the active descendant on the search input only", async () => {
    const user = userEvent.setup();
    renderSelect({ withSearch: true, defaultOpen: true });
    const searchInput = getSearchInput();
    await user.type(searchInput, "ban");

    const bananaOption = screen.getByRole("option", { name: /banana/i });
    expect(searchInput).toHaveAttribute("aria-activedescendant", bananaOption.id);
    expect(getSelectTrigger()).not.toHaveAttribute("aria-activedescendant");
    expect(screen.getByRole("listbox")).not.toHaveAttribute("aria-activedescendant");
  });

  it("generates unique option ids for values that differ by whitespace and punctuation", () => {
    renderSelectInline({
      defaultOpen: true,
      children: (
        <>
          <Select.Item value="a b">Spaced</Select.Item>
          <Select.Item value="a_b">Underscore</Select.Item>
        </>
      ),
    });

    const spaced = screen.getByRole("option", { name: "Spaced" });
    const underscore = screen.getByRole("option", { name: "Underscore" });
    expect(spaced.id).toBeTruthy();
    expect(underscore.id).toBeTruthy();
    expect(spaced.id).not.toBe(underscore.id);
  });

  it("omits stale controlled active descendants for disabled, filtered, and missing options", async () => {
    const user = userEvent.setup();
    function renderStale(children: ReactNode, opts: { withSearch?: boolean; highlighted: string }) {
      return (
        <Select variant="card" defaultOpen highlighted={opts.highlighted}>
          <Select.Trigger>
            <Select.Value placeholder="Pick a value" />
          </Select.Trigger>
          <Select.Content>
            {opts.withSearch && <Select.Search />}
            {children}
          </Select.Content>
        </Select>
      );
    }

    const { rerender } = render(
      renderStale(
        <>
          <Select.Item value="apple">Apple</Select.Item>
          <Select.Item value="banana" disabled>
            Banana
          </Select.Item>
        </>,
        { highlighted: "banana" },
      ),
    );
    expect(screen.getByRole("listbox")).not.toHaveAttribute("aria-activedescendant");

    rerender(
      renderStale(
        <>
          <Select.Item value="apple">Apple</Select.Item>
          <Select.Item value="banana">Banana</Select.Item>
        </>,
        { highlighted: "banana", withSearch: true },
      ),
    );
    await user.type(getSearchInput(), "apple");
    expect(getSelectTrigger()).not.toHaveAttribute("aria-activedescendant");
    expect(getSearchInput()).not.toHaveAttribute("aria-activedescendant");
    expect(screen.getByRole("listbox")).not.toHaveAttribute("aria-activedescendant");

    rerender(
      renderStale(<Select.Item value="apple">Apple</Select.Item>, { highlighted: "missing" }),
    );
    expect(screen.getByRole("listbox")).not.toHaveAttribute("aria-activedescendant");
    expect(getSelectTrigger()).not.toHaveAttribute("aria-activedescendant");
  });
});

describe("Select accessibility", () => {
  it.each<{ readonly mode: "single" | "multiple" }>([
    { mode: "single" },
    { mode: "multiple" },
  ])("has no a11y violations in $mode mode", async ({ mode }) => {
    const { container } =
      mode === "multiple"
        ? renderSelect({ multiple: true, defaultOpen: true, defaultValue: ["apple"] })
        : renderSelect({ defaultOpen: true });
    expect(await axe(container)).toHaveNoViolations();
  });

  it("merges a consumer multi-id aria-describedby on the trigger via mergeIds", () => {
    render(
      <>
        <span id="hint-a">a</span>
        <span id="hint-b">b</span>
        <Select>
          <Select.Trigger aria-label="Fruit" aria-describedby="hint-a hint-b">
            <Select.Value placeholder={PICK_FRUIT} />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="apple">Apple</Select.Item>
          </Select.Content>
        </Select>
      </>,
    );
    expect(getSelectTrigger()).toHaveAttribute("aria-describedby", "hint-a hint-b");
  });

  it("overrides the searchable results-count live region via getResultsLabel", async () => {
    const user = userEvent.setup();
    render(
      <Select defaultOpen>
        <Select.Trigger aria-label="Fruit">
          <Select.Value placeholder={PICK_FRUIT} />
        </Select.Trigger>
        <Select.Content getResultsLabel={(count) => `${count} trafień`}>
          <Select.Search />
          <Select.Item value="apple">Apple</Select.Item>
          <Select.Item value="banana">Banana</Select.Item>
          <Select.Empty />
        </Select.Content>
      </Select>,
    );
    await user.type(getSearchInput(), "a");
    expect(screen.getByRole("status")).toHaveTextContent(/trafień/);
  });

  it("surfaces an unlabeled trigger to axe instead of a 'Select' fallback name", async () => {
    const { container } = render(
      <Select>
        <Select.Trigger>
          <Select.Value placeholder={PICK_FRUIT} />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="apple">Apple</Select.Item>
        </Select.Content>
      </Select>,
    );
    const trigger = container.querySelector<HTMLElement>('[data-slot="select-trigger"]');
    expect(trigger).not.toHaveAttribute("aria-label");
    expect(trigger).not.toHaveAttribute("aria-labelledby");
    const results = await axe(container);
    expect(results.violations.map((violation) => violation.id)).toContain("button-name");
  });

  it("search input uses Field label via aria-labelledby when inside a Field", () => {
    render(
      <Field>
        <Field.Label>Region</Field.Label>
        <Field.Control>
          <Select variant="card" defaultOpen>
            <Select.Trigger>
              <Select.Value placeholder="Pick a region" />
            </Select.Trigger>
            <Select.Content>
              <Select.Search />
              <Select.Item value="us">United States</Select.Item>
              <Select.Item value="eu">Europe</Select.Item>
            </Select.Content>
          </Select>
        </Field.Control>
      </Field>,
    );

    const searchInput = screen.getByRole("combobox", { name: "Region" });
    const fieldLabel = screen.getByText("Region");
    expect(searchInput).toHaveAttribute("aria-labelledby", fieldLabel.id);
    expect(searchInput).not.toHaveAttribute("aria-label");
  });

  it("merges a Field label with a trigger-level aria-labelledby via mergeIds", () => {
    render(
      <>
        <span id="extra-label">Preferred</span>
        <Field>
          <Field.Label>Region</Field.Label>
          <Field.Control>
            <Select variant="card">
              <Select.Trigger aria-labelledby="extra-label">
                <Select.Value placeholder="Pick a region" />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="us">United States</Select.Item>
              </Select.Content>
            </Select>
          </Field.Control>
        </Field>
      </>,
    );

    const fieldLabel = screen.getByText("Region");
    expect(getSelectTrigger()).toHaveAttribute("aria-labelledby", `extra-label ${fieldLabel.id}`);
  });

  it("wires Field description and error ids onto the search input while searching", () => {
    render(
      <Field invalid>
        <Field.Label>Region</Field.Label>
        <Field.Control>
          <Select variant="card" defaultOpen>
            <Select.Trigger>
              <Select.Value placeholder="Pick a region" />
            </Select.Trigger>
            <Select.Content>
              <Select.Search />
              <Select.Item value="us">United States</Select.Item>
            </Select.Content>
          </Select>
        </Field.Control>
        <Field.Description>Pick your billing region</Field.Description>
        <Field.Error>Region is required</Field.Error>
      </Field>,
    );

    const searchInput = screen.getByRole("combobox", { name: "Region" });
    const description = screen.getByText("Pick your billing region");
    const error = screen.getByText("Region is required");
    expect(searchInput).toHaveAttribute("aria-describedby", `${error.id} ${description.id}`);
    expect(searchInput).toHaveAttribute("aria-invalid", "true");
  });

  it("wires Field description and error ids onto the open non-search listbox", () => {
    render(
      <Field invalid>
        <Field.Label>Region</Field.Label>
        <Field.Control>
          <Select variant="card" required defaultOpen>
            <Select.Trigger>
              <Select.Value placeholder="Pick a region" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="us">United States</Select.Item>
            </Select.Content>
          </Select>
        </Field.Control>
        <Field.Description>Pick your billing region</Field.Description>
        <Field.Error>Region is required</Field.Error>
      </Field>,
    );

    const listbox = screen.getByRole("listbox");
    const description = screen.getByText("Pick your billing region");
    const error = screen.getByText("Region is required");
    expect(listbox).toHaveAttribute("aria-describedby", `${error.id} ${description.id}`);
    expect(listbox).toHaveAttribute("aria-invalid", "true");
    expect(listbox).toHaveAttribute("aria-required", "true");
  });
});

describe("Select respects prefers-reduced-motion", () => {
  // jsdom evaluates no @media and does not compile the Tailwind open-state rules,
  // so animationName is not observable. The fixture lifts the reduced-motion
  // :root overrides out of @media; the assertions read the resolved variables.
  applyReducedMotionFixture();

  it("neutralizes dropdown enter and exit motion when the listbox is open", async () => {
    renderSelect({ defaultOpen: true, variant: "default" });

    const listbox = await screen.findByRole("listbox");
    const root = listbox.ownerDocument.documentElement;
    const resolved = (name: string) => getComputedStyle(root).getPropertyValue(name).trim();

    expect(resolved("--ui-content-enter-from-top")).toMatch(/^ui-content-enter-fade\b/);
    expect(resolved("--ui-content-enter-from-bottom")).toMatch(/^ui-content-enter-fade\b/);
    expect(resolved("--ui-content-enter-from-left")).toMatch(/^ui-content-enter-fade\b/);
    expect(resolved("--ui-content-enter-from-right")).toMatch(/^ui-content-enter-fade\b/);
    expect(resolved("--ui-content-exit-to-top")).toMatch(/^ui-content-exit-fade\b/);
    expect(resolved("--ui-content-exit-to-bottom")).toMatch(/^ui-content-exit-fade\b/);
    expect(resolved("--ui-content-exit-to-left")).toMatch(/^ui-content-exit-fade\b/);
    expect(resolved("--ui-content-exit-to-right")).toMatch(/^ui-content-exit-fade\b/);
  });
});

/** SelectContent's default gap between trigger and dropdown. */
const SIDE_OFFSET = 4;
/** FloatingPanel's default gap between the dropdown and the viewport edge. */
const COLLISION_PADDING = 8;

describe("Select dropdown width", () => {
  it("clamps dropdown to trigger width via the CSS variable", async () => {
    renderSelect({
      defaultOpen: true,
      variant: "default",
      items: [
        "A short one",
        "An extremely long option label that would otherwise stretch the dropdown",
      ],
    });

    const listbox = await screen.findByRole("listbox");
    expect(listbox.style.width).toBe("var(--ui-floating-trigger-width)");
    expect(listbox.style.minWidth).toBe("");
  });

  // FloatingPanel owns the cap: it writes the resolved px max-height last, so it wins over
  // the caller style on the same element and the public
  // --floating-panel-available-height var carries the same number for inner scroll regions.
  // jsdom compiles no Tailwind, so the scroll box itself is not observable; the listbox is
  // the scroller, asserted through its documented overflow class.
  it("bounds a long dropdown to the room below the trigger and scrolls the overflow", async () => {
    renderSelect({
      defaultOpen: true,
      variant: "default",
      items: Array.from({ length: 40 }, (_, i) => `Option ${i}`),
    });
    const trigger = getSelectTrigger();
    const listbox = await screen.findByRole("listbox");

    stubTriggerRect(trigger, 100);
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });

    // Room below the trigger, minus the two gaps the dropdown reserves.
    const available =
      window.innerHeight - trigger.getBoundingClientRect().bottom - SIDE_OFFSET - COLLISION_PADDING;
    await waitFor(() => {
      expect(listbox.style.maxHeight).toBe(`${available}px`);
    });
    expect(listbox).toHaveAttribute("data-side", "bottom");
    expect(listbox.style.getPropertyValue("--floating-panel-available-height")).toBe(
      `${available}px`,
    );
    expect(listbox).toHaveClass("overflow-y-auto");
  });
});

// jsdom compiles no Tailwind, so the rendered outline is not observable here. These
// assert the documented per-variant focus-indicator class contract instead: the card
// trigger paints an inverted --foreground surface where an inset --ring is invisible, so
// it must carry the outside outline and must not fall back to the inset field ring.
describe("Select trigger focus indicator", () => {
  const INSET_RING = ["focus:border-ring", "focus:ring-1", "focus:ring-ring"];
  const OUTSIDE_OUTLINE = FOCUS_OUTLINE.split(" ");

  it("draws the card trigger focus indicator outside the inverted header", async () => {
    const user = userEvent.setup();
    renderSelect({ variant: "card" });
    const trigger = getSelectTrigger();

    await user.tab();

    expect(trigger).toHaveFocus();
    expect(trigger).toHaveClass(...OUTSIDE_OUTLINE);
    for (const inset of INSET_RING) {
      expect(trigger).not.toHaveClass(inset);
    }
  });

  it("keeps the inset field ring on the default trigger", async () => {
    const user = userEvent.setup();
    renderSelect({ variant: "default" });
    const trigger = getSelectTrigger();

    await user.tab();

    expect(trigger).toHaveFocus();
    expect(trigger).toHaveClass(...INSET_RING);
    for (const outline of OUTSIDE_OUTLINE) {
      expect(trigger).not.toHaveClass(outline);
    }
  });
});

describe("Select open listbox anchor tracking", () => {
  it("follows the trigger while the page scrolls and stops painting once the trigger scrolls off screen", async () => {
    renderSelect({ defaultOpen: true, variant: "default" });
    const trigger = getSelectTrigger();
    const listbox = await screen.findByRole("listbox");

    stubTriggerRect(trigger, 100);
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    await waitFor(() => {
      expect(listbox.style.top).toBe("136px");
    });
    expect(listbox.style.left).toBe("40px");
    expect(listbox).not.toHaveAttribute("data-anchor-hidden");

    stubTriggerRect(trigger, 300);
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    await waitFor(() => {
      expect(listbox.style.top).toBe("336px");
    });
    expect(listbox).not.toHaveAttribute("data-anchor-hidden");

    stubTriggerRect(trigger, -80);
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    await waitFor(() => {
      expect(listbox).toHaveAttribute("data-anchor-hidden", "");
    });
    expect(listbox.style.opacity).toBe("0");
    expect(listbox.style.pointerEvents).toBe("none");

    stubTriggerRect(trigger, 100);
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    await waitFor(() => {
      expect(listbox).not.toHaveAttribute("data-anchor-hidden");
    });
    expect(listbox.style.opacity).toBe("");
    expect(listbox.style.top).toBe("136px");
  });

  it("keeps the suppressed listbox mounted and focusable so an open select never drops focus mid-scroll", async () => {
    renderSelect({ defaultOpen: true, variant: "default" });
    const trigger = getSelectTrigger();
    const listbox = await screen.findByRole("listbox");
    listbox.focus();

    stubTriggerRect(trigger, -80);
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    await waitFor(() => {
      expect(listbox).toHaveAttribute("data-anchor-hidden", "");
    });

    expect(screen.getByRole("listbox")).toBe(listbox);
    expect(listbox).toHaveFocus();
    expect(listbox.style.visibility).toBe("visible");
  });
});

describe("Select cross-document portal", () => {
  it("renders dropdown content into an explicit portalContainer", async () => {
    const portalHost = document.createElement("div");
    portalHost.id = "select-portal-host";
    document.body.appendChild(portalHost);

    render(
      <Select defaultOpen>
        <Select.Trigger>
          <Select.Value placeholder={PICK_FRUIT} />
        </Select.Trigger>
        <Select.Content portalContainer={portalHost}>
          <Select.Item value="apple">Apple</Select.Item>
          <Select.Item value="banana">Banana</Select.Item>
        </Select.Content>
      </Select>,
    );

    expect(portalHost.querySelector('[role="listbox"]')).not.toBeNull();

    portalHost.remove();
  });
});
