import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { Select } from "./index";
import {
  getSearchInput,
  getSelectTrigger,
  PICK_FRUIT,
  renderSelect,
  withScrollIntoViewSpy,
} from "./select-test-utils";

describe("Select Tab-close focus restore", () => {
  it("restores focus to the trigger when Tab-closing a multiple select", () => {
    render(
      <>
        <Select variant="default" multiple defaultValue={[]} defaultOpen>
          <Select.Trigger>
            <Select.Tags placeholder="Pick" />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="apple">Apple</Select.Item>
            <Select.Item value="banana">Banana</Select.Item>
          </Select.Content>
        </Select>
        <button type="button">After</button>
      </>,
    );

    const listbox = screen.getByRole("listbox");
    listbox.focus();
    // fireEvent retained: direct keydown asserts synchronous focus handoff before browser Tab movement.
    fireEvent.keyDown(listbox, { key: "Tab" });

    expect(getSelectTrigger()).toHaveAttribute("aria-expanded", "false");
    expect(getSelectTrigger()).toHaveFocus();
  });

  it("restores focus to the trigger synchronously when Tab-closing a searchable select with no highlight", async () => {
    render(
      <>
        <Select variant="default" defaultOpen highlighted={null}>
          <Select.Trigger>
            <Select.Value placeholder="Pick" />
          </Select.Trigger>
          <Select.Content>
            <Select.Search />
            <Select.Item value="apple">Apple</Select.Item>
            <Select.Item value="banana">Banana</Select.Item>
          </Select.Content>
        </Select>
        <button type="button">After</button>
      </>,
    );

    const searchInput = getSearchInput();
    searchInput.focus();
    // fireEvent retained: direct keydown asserts focus handoff while the search input unmounts.
    fireEvent.keyDown(searchInput, { key: "Tab" });

    expect(getSelectTrigger()).toHaveAttribute("aria-expanded", "false");
    expect(getSelectTrigger()).toHaveFocus();
  });
});

describe("Select open-focus stability", () => {
  it.each([
    { initialState: "missing", initialDisabled: false },
    { initialState: "disabled", initialDisabled: true },
  ])("initializes a late enabled option after opening with it $initialState", async ({
    initialDisabled,
  }) => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    function Harness({ ready }: { ready: boolean }) {
      const showOption = initialDisabled || ready;
      return (
        <Select variant="default" onChange={onChange}>
          <Select.Trigger aria-label="Fruit">
            <Select.Value placeholder={PICK_FRUIT} />
          </Select.Trigger>
          <Select.Content>
            {showOption && (
              <Select.Item value="apple" disabled={!ready}>
                Apple
              </Select.Item>
            )}
          </Select.Content>
        </Select>
      );
    }

    const { rerender } = render(<Harness ready={false} />);
    await user.click(getSelectTrigger());
    const listbox = screen.getByRole("listbox");
    expect(listbox).not.toHaveAttribute("aria-activedescendant");

    rerender(<Harness ready />);

    const apple = screen.getByRole("option", { name: "Apple" });
    await waitFor(() => expect(listbox).toHaveAttribute("aria-activedescendant", apple.id));
    expect(listbox).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("apple");
  });

  it("requests a controlled highlight when the first option arrives", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    function Harness({ ready }: { ready: boolean }) {
      const [highlighted, setHighlighted] = useState<string | null>(null);
      return (
        <Select
          variant="default"
          highlighted={highlighted}
          onHighlightChange={setHighlighted}
          onChange={onChange}
        >
          <Select.Trigger aria-label="Fruit">
            <Select.Value placeholder={PICK_FRUIT} />
          </Select.Trigger>
          <Select.Content>{ready && <Select.Item value="apple">Apple</Select.Item>}</Select.Content>
        </Select>
      );
    }

    const { rerender } = render(<Harness ready={false} />);
    await user.click(getSelectTrigger());
    const listbox = screen.getByRole("listbox");

    rerender(<Harness ready />);

    const apple = screen.getByRole("option", { name: "Apple" });
    await waitFor(() => expect(listbox).toHaveAttribute("aria-activedescendant", apple.id));
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("apple");
  });

  it.each([
    {
      label: "default-open dropdown",
      variant: "default" as const,
      controlled: false,
      searchable: false,
    },
    {
      label: "controlled-open dropdown",
      variant: "default" as const,
      controlled: true,
      searchable: false,
    },
    {
      label: "default-open card",
      variant: "card" as const,
      controlled: false,
      searchable: false,
    },
    {
      label: "controlled-open card",
      variant: "card" as const,
      controlled: true,
      searchable: false,
    },
    {
      label: "default-open searchable dropdown",
      variant: "default" as const,
      controlled: false,
      searchable: true,
    },
    {
      label: "controlled-open searchable dropdown",
      variant: "default" as const,
      controlled: true,
      searchable: true,
    },
  ])("initializes a $label without moving document focus", async ({
    variant,
    controlled,
    searchable,
  }) => {
    renderSelect({
      variant,
      withSearch: searchable,
      ...(controlled ? { open: true } : { defaultOpen: true }),
    });

    const listbox = await screen.findByRole("listbox");
    const apple = screen.getByRole("option", { name: "Apple" });
    const activeDescendantOwner = searchable ? getSearchInput() : listbox;
    await waitFor(() =>
      expect(activeDescendantOwner).toHaveAttribute("aria-activedescendant", apple.id),
    );
    expect(document.body).toHaveFocus();
  });

  it.each([
    { label: "non-searchable", searchable: false },
    { label: "searchable", searchable: true },
  ])("does not steal focus when a $label default-open Select mounts late", async ({
    searchable,
  }) => {
    const user = userEvent.setup();

    function Harness() {
      const [isMounted, setIsMounted] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setIsMounted(true)}>
            Mount Select
          </button>
          {isMounted && (
            <Select variant="card" defaultOpen>
              <Select.Trigger aria-label="Fruit">
                <Select.Value placeholder={PICK_FRUIT} />
              </Select.Trigger>
              <Select.Content>
                {searchable && <Select.Search />}
                <Select.Item value="apple">Apple</Select.Item>
                <Select.Item value="banana">Banana</Select.Item>
              </Select.Content>
            </Select>
          )}
        </>
      );
    }

    render(<Harness />);
    const focusOwner = screen.getByRole("button", { name: "Mount Select" });
    await user.click(focusOwner);

    const listbox = screen.getByRole("listbox");
    const apple = screen.getByRole("option", { name: "Apple" });
    const activeDescendantOwner = searchable ? getSearchInput() : listbox;
    await waitFor(() =>
      expect(activeDescendantOwner).toHaveAttribute("aria-activedescendant", apple.id),
    );
    expect(focusOwner).toHaveFocus();
  });

  it("focuses and scrolls conditionally mounted content after a controlled open transition", async () => {
    function Harness({ open }: { open: boolean }) {
      return (
        <Select variant="default" open={open} defaultValue="banana">
          <Select.Trigger aria-label="Fruit">
            <Select.Value placeholder={PICK_FRUIT} />
          </Select.Trigger>
          {open && (
            <Select.Content>
              <Select.Item value="apple">Apple</Select.Item>
              <Select.Item value="banana">Banana</Select.Item>
            </Select.Content>
          )}
        </Select>
      );
    }

    await withScrollIntoViewSpy(async (scrolledElements) => {
      const { rerender } = render(<Harness open={false} />);
      rerender(<Harness open />);

      const listbox = await screen.findByRole("listbox");
      const banana = screen.getByRole("option", { name: "Banana" });
      await waitFor(() => expect(listbox).toHaveFocus());
      await waitFor(() => expect(scrolledElements).toContain(banana));
    });
  });

  it.each([
    { label: "dropdown", variant: "default" as const, searchable: false },
    { label: "searchable dropdown", variant: "default" as const, searchable: true },
    { label: "card", variant: "card" as const, searchable: false },
  ])("focuses the open content and reveals the selected option when an initially-open $label is closed and reopened", async ({
    variant,
    searchable,
  }) => {
    const user = userEvent.setup();

    await withScrollIntoViewSpy(async (scrolledElements) => {
      renderSelect({ variant, withSearch: searchable, defaultOpen: true, defaultValue: "banana" });
      await user.click(document.body);
      expect(getSelectTrigger()).toHaveAttribute("aria-expanded", "false");

      await user.click(getSelectTrigger());

      const listbox = await screen.findByRole("listbox");
      const focusOwner = searchable ? getSearchInput() : listbox;
      await waitFor(() => expect(focusOwner).toHaveFocus());
      const banana = screen.getByRole("option", { name: "Banana" });
      await waitFor(() => expect(scrolledElements).toContain(banana));
    });
  });

  it("focuses the listbox after opening but does not re-steal focus on later re-renders", async () => {
    const user = userEvent.setup();

    function Harness({ extra }: { extra: string }) {
      return (
        <>
          <Select variant="default">
            <Select.Trigger>
              <Select.Value placeholder="Pick" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="apple">Apple {extra}</Select.Item>
              <Select.Item value="banana">Banana {extra}</Select.Item>
            </Select.Content>
          </Select>
          <button type="button">Outside</button>
        </>
      );
    }

    const { rerender } = render(<Harness extra="x" />);
    await user.click(getSelectTrigger());
    const listbox = screen.getByRole("listbox");
    await waitFor(() => expect(listbox).toHaveFocus());

    const outside = screen.getByRole("button", { name: "Outside" });
    outside.focus();
    expect(outside).toHaveFocus();

    rerender(<Harness extra="y" />);
    expect(screen.getByRole("button", { name: "Outside" })).toHaveFocus();
  });

  it("has no a11y violations while the listbox holds focus after opening", async () => {
    const user = userEvent.setup();
    const { container } = renderSelect();
    await user.click(getSelectTrigger());
    await waitFor(() => expect(screen.getByRole("listbox")).toHaveFocus());
    expect(await axe(container)).toHaveNoViolations();
  });
});
