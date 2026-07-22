import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { Select } from "./index";
import {
  getSearchInput,
  getSelectTrigger,
  PICK_FRUIT,
  renderSelect,
  renderSelectInline,
} from "./select.test-utils";

describe("Select keyboard navigation", () => {
  it.each(["Enter", " ", "ArrowDown"])("opens with %s key on trigger", async (key) => {
    const user = userEvent.setup();
    renderSelect();
    getSelectTrigger().focus();
    await user.keyboard(key === " " ? " " : `{${key}}`);
    expect(getSelectTrigger()).toHaveAttribute("aria-expanded", "true");
  });

  it("transfers focus from its trigger to the listbox when opening", async () => {
    const user = userEvent.setup();
    renderSelect({ variant: "default" });
    getSelectTrigger().focus();
    await user.keyboard("{Enter}");

    expect(screen.getByRole("listbox")).toHaveFocus();
  });

  it("transfers focus from trigger toggle to search combobox when opening searchable Select via keyboard", async () => {
    const user = userEvent.setup();
    renderSelect({ withSearch: true });
    getSelectTrigger().focus();
    await user.keyboard("{ArrowDown}");

    const searchInput = getSearchInput();
    expect(searchInput).toHaveFocus();
    expect(searchInput).toHaveAttribute("aria-expanded", "true");
    expect(searchInput).toHaveAttribute("aria-controls", screen.getByRole("listbox").id);
  });

  it("closes with Escape key", async () => {
    const user = userEvent.setup();
    renderSelect({ variant: "default", defaultOpen: true });
    screen.getByRole("listbox").focus();
    await user.keyboard("{Escape}");
    expect(getSelectTrigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("closes with Escape when focus has moved outside the listbox", async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Outside</button>
        <Select defaultOpen>
          <Select.Trigger aria-label="Fruit">
            <Select.Value placeholder={PICK_FRUIT} />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="apple">Apple</Select.Item>
            <Select.Item value="banana">Banana</Select.Item>
          </Select.Content>
        </Select>
      </>,
    );

    const outside = screen.getByRole("button", { name: "Outside" });
    outside.focus();
    expect(outside).toHaveFocus();

    await user.keyboard("{Escape}");

    expect(getSelectTrigger()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox", { hidden: true })).not.toBeInTheDocument();
    expect(getSelectTrigger()).toHaveFocus();
  });

  it("closes with Escape from outside focus even when the outside handler prevents default", async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button" onKeyDown={(event) => event.preventDefault()}>
          Outside
        </button>
        <Select defaultOpen>
          <Select.Trigger aria-label="Fruit">
            <Select.Value placeholder={PICK_FRUIT} />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="apple">Apple</Select.Item>
            <Select.Item value="banana">Banana</Select.Item>
          </Select.Content>
        </Select>
      </>,
    );

    screen.getByRole("button", { name: "Outside" }).focus();
    await user.keyboard("{Escape}");

    expect(getSelectTrigger()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox", { hidden: true })).not.toBeInTheDocument();
  });

  it("closes the focused open Select when another Select also starts open", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Select>
          <Select.Trigger aria-label="Branch">
            <Select.Value placeholder="Select a branch..." />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="main">main</Select.Item>
            <Select.Item value="develop">develop</Select.Item>
          </Select.Content>
        </Select>
        <Select defaultOpen>
          <Select.Trigger aria-label="Framework">
            <Select.Value placeholder="Select framework..." />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="react">React</Select.Item>
            <Select.Item value="vue">Vue</Select.Item>
          </Select.Content>
        </Select>
      </>,
    );

    const branchTrigger = screen.getByRole("combobox", { name: "Branch" });
    branchTrigger.focus();
    await user.keyboard("{Enter}");

    expect(branchTrigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("combobox", { name: "Framework" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    await user.keyboard("{Escape}");

    expect(branchTrigger).toHaveAttribute("aria-expanded", "false");
  });

  it("honors preventDefault for Escape inside content key handlers", async () => {
    const user = userEvent.setup();
    render(
      <Select defaultOpen>
        <Select.Trigger aria-label="Fruit">
          <Select.Value placeholder={PICK_FRUIT} />
        </Select.Trigger>
        <Select.Content onKeyDown={(event) => event.preventDefault()}>
          <Select.Item value="apple">Apple</Select.Item>
          <Select.Item value="banana">Banana</Select.Item>
        </Select.Content>
      </Select>,
    );

    screen.getByRole("listbox").focus();
    await user.keyboard("{Escape}");

    expect(getSelectTrigger()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("listbox")).toHaveAttribute("data-state", "open");
  });

  it("navigates and selects options from the listbox", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSelect({ onChange, defaultOpen: true });
    const listbox = screen.getByRole("listbox");
    const bananaOption = screen.getByRole("option", { name: /banana/i });
    listbox.focus();

    await user.keyboard("{ArrowDown}");
    expect(listbox).toHaveAttribute("aria-activedescendant", bananaOption.id);
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("banana");
  });

  it("moves and selects options from the searchable input with Arrow keys and Enter", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSelect({ withSearch: true, defaultOpen: true, onChange });

    const searchInput = getSearchInput();
    const bananaOption = screen.getByRole("option", { name: /banana/i });

    await user.type(searchInput, "{ArrowDown}");
    expect(searchInput).toHaveAttribute("aria-activedescendant", bananaOption.id);
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("banana");
  });

  it("ignores Enter and Escape during IME composition in the searchable select", () => {
    const onChange = vi.fn();
    renderSelect({ withSearch: true, defaultOpen: true, onChange });

    const searchInput = getSearchInput();
    // fireEvent retained: userEvent cannot mark key events as IME composition events.
    fireEvent.keyDown(searchInput, { key: "Enter", isComposing: true, keyCode: 229 });
    expect(onChange).not.toHaveBeenCalled();
    expect(getSelectTrigger()).toHaveAttribute("aria-expanded", "true");

    // fireEvent retained: userEvent cannot mark key events as IME composition events.
    fireEvent.keyDown(searchInput, { key: "Escape", isComposing: true, keyCode: 229 });
    expect(getSelectTrigger()).toHaveAttribute("aria-expanded", "true");
    expect(getSearchInput()).toBeInTheDocument();
  });

  it("closes only the focused or topmost Select on Escape", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Select defaultOpen>
          <Select.Trigger aria-label="First fruit">
            <Select.Value placeholder="Pick first" />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="apple">Apple</Select.Item>
          </Select.Content>
        </Select>
        <Select defaultOpen>
          <Select.Trigger aria-label="Second fruit">
            <Select.Value placeholder="Pick second" />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="banana">Banana</Select.Item>
          </Select.Content>
        </Select>
      </>,
    );
    const firstTrigger = screen.getByRole("combobox", { name: "First fruit" });
    const secondTrigger = screen.getByRole("combobox", { name: "Second fruit" });
    const [firstListbox] = screen.getAllByRole("listbox");
    firstListbox?.focus();

    await user.keyboard("{Escape}");

    expect(firstTrigger).toHaveAttribute("aria-expanded", "false");
    expect(secondTrigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("listbox")).toHaveLength(1);

    // fireEvent retained: an Escape dispatched outside every Select has no userEvent focus target.
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(secondTrigger).toHaveAttribute("aria-expanded", "false");
  });

  it("honors preventDefault in content key handlers", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Select variant="card" defaultOpen highlighted="banana" onChange={onChange}>
        <Select.Trigger>
          <Select.Value />
        </Select.Trigger>
        <Select.Content onKeyDown={(event) => event.preventDefault()}>
          <Select.Item value="banana">Banana</Select.Item>
        </Select.Content>
      </Select>,
    );

    screen.getByRole("listbox").focus();
    await user.keyboard("{Enter}");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("closes on outside click", async () => {
    const user = userEvent.setup();
    renderSelect({ defaultOpen: true });
    expect(getSelectTrigger()).toHaveAttribute("aria-expanded", "true");
    await user.click(document.body);
    expect(getSelectTrigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("card variant does not hijack Escape from an unrelated focused input", () => {
    render(
      <>
        <input aria-label="Unrelated" />
        <Select variant="card" defaultOpen>
          <Select.Trigger aria-label="Fruit">
            <Select.Value placeholder={PICK_FRUIT} />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="apple">Apple</Select.Item>
            <Select.Item value="banana">Banana</Select.Item>
          </Select.Content>
        </Select>
      </>,
    );

    const outsideInput = screen.getByRole("textbox", { name: "Unrelated" });
    outsideInput.focus();
    const event = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });

    outsideInput.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(screen.getByRole("listbox")).toBeVisible();
    expect(outsideInput).toHaveFocus();
  });

  it("card variant keeps its inline list on Tab and does not commit the highlighted option", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSelectInline({
      defaultOpen: true,
      onChange,
      children: (
        <>
          <Select.Item value="apple">Apple</Select.Item>
          <Select.Item value="banana">Banana</Select.Item>
        </>
      ),
    });

    const listbox = screen.getByRole("listbox");
    listbox.focus();
    await user.keyboard("{ArrowDown}");
    expect(listbox).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: /banana/i }).id,
    );

    await user.tab();

    expect(listbox).toBeVisible();
    expect(getSelectTrigger()).toHaveAttribute("aria-expanded", "true");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("opens with the first enabled option highlighted on Home from the closed trigger", async () => {
    const user = userEvent.setup();
    renderSelect();
    getSelectTrigger().focus();
    await user.keyboard("{Home}");

    expect(getSelectTrigger()).toHaveAttribute("aria-expanded", "true");
    const listbox = screen.getByRole("listbox");
    expect(listbox).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: /apple/i }).id,
    );
  });

  it("opens with the last enabled option highlighted on End from the closed trigger", async () => {
    const user = userEvent.setup();
    renderSelect();
    getSelectTrigger().focus();
    await user.keyboard("{End}");

    expect(getSelectTrigger()).toHaveAttribute("aria-expanded", "true");
    const listbox = screen.getByRole("listbox");
    expect(listbox).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: /cherry/i }).id,
    );
  });

  it("opens and highlights the first typeahead match on a printable character from the closed trigger", async () => {
    const user = userEvent.setup();
    renderSelect();
    getSelectTrigger().focus();
    await user.keyboard("b");

    expect(getSelectTrigger()).toHaveAttribute("aria-expanded", "true");
    const listbox = screen.getByRole("listbox");
    expect(listbox).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: /banana/i }).id,
    );
  });

  it("starts a fresh typeahead query after close and reopen", async () => {
    const user = userEvent.setup();
    renderSelect();
    getSelectTrigger().focus();

    await user.keyboard("a");
    expect(screen.getByRole("listbox")).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: /apple/i }).id,
    );

    await user.keyboard("{Escape}");
    await user.keyboard("b");

    expect(screen.getByRole("listbox")).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: /banana/i }).id,
    );
  });

  it("scrolls the selected option into view when the dropdown opens", async () => {
    const user = userEvent.setup();
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    const scrolledElements: Element[] = [];
    const scrollFn = vi.fn(function (this: Element) {
      scrolledElements.push(this);
    });
    Element.prototype.scrollIntoView = scrollFn;
    const items = Array.from({ length: 50 }, (_, index) => `Option ${index + 1}`);

    try {
      const { unmount } = renderSelect({
        variant: "default",
        defaultValue: "option 45",
        items,
      });

      await user.click(getSelectTrigger());
      await waitFor(() => expect(scrollFn).toHaveBeenCalledWith({ block: "nearest" }));
      expect(scrolledElements).toContain(screen.getByRole("option", { name: "Option 45" }));

      unmount();
      scrollFn.mockClear();
      scrolledElements.length = 0;

      renderSelect({ variant: "default", items });
      getSelectTrigger().focus();
      await user.keyboard("{End}");

      await waitFor(() => expect(scrollFn).toHaveBeenCalledWith({ block: "nearest" }));
      expect(scrolledElements).toContain(screen.getByRole("option", { name: "Option 50" }));
    } finally {
      if (originalScrollIntoView) {
        Element.prototype.scrollIntoView = originalScrollIntoView;
      } else {
        Reflect.deleteProperty(Element.prototype, "scrollIntoView");
      }
    }
  });

  it("scrolls the new highlighted option into view on listbox typeahead", async () => {
    const user = userEvent.setup();
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    const scrolledElements: Element[] = [];
    const scrollFn = vi.fn(function (this: Element) {
      scrolledElements.push(this);
    });
    Element.prototype.scrollIntoView = scrollFn;

    try {
      renderSelect({ defaultOpen: true });
      await waitFor(() => expect(scrollFn).toHaveBeenCalledWith({ block: "nearest" }));
      scrollFn.mockClear();
      scrolledElements.length = 0;

      screen.getByRole("listbox").focus();
      await user.keyboard("b");

      await waitFor(() => expect(scrollFn).toHaveBeenCalledWith({ block: "nearest" }));
      expect(scrolledElements).toContain(screen.getByRole("option", { name: /banana/i }));
    } finally {
      if (originalScrollIntoView) {
        Element.prototype.scrollIntoView = originalScrollIntoView;
      } else {
        Reflect.deleteProperty(Element.prototype, "scrollIntoView");
      }
    }
  });

  it("scrolls the new highlighted option into view on searchable arrow navigation", async () => {
    const user = userEvent.setup();
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    const scrolledElements: Element[] = [];
    const scrollFn = vi.fn(function (this: Element) {
      scrolledElements.push(this);
    });
    Element.prototype.scrollIntoView = scrollFn;

    try {
      renderSelect({ withSearch: true, defaultOpen: true });
      await waitFor(() => expect(scrollFn).toHaveBeenCalledWith({ block: "nearest" }));
      scrollFn.mockClear();
      scrolledElements.length = 0;

      await user.type(getSearchInput(), "{ArrowDown}");

      await waitFor(() => expect(scrollFn).toHaveBeenCalledWith({ block: "nearest" }));
      expect(scrolledElements).toContain(screen.getByRole("option", { name: /banana/i }));
    } finally {
      if (originalScrollIntoView) {
        Element.prototype.scrollIntoView = originalScrollIntoView;
      } else {
        Reflect.deleteProperty(Element.prototype, "scrollIntoView");
      }
    }
  });

  it("extends the listbox typeahead query with Space without selecting", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSelectInline({
      defaultOpen: true,
      onChange,
      children: (
        <>
          <Select.Item value="ny">New York</Select.Item>
          <Select.Item value="nj">New Jersey</Select.Item>
        </>
      ),
    });

    const listbox = screen.getByRole("listbox");
    listbox.focus();
    await user.keyboard("new y");

    expect(listbox).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: "New York" }).id,
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it("has no a11y violations with the listbox open via keyboard navigation", async () => {
    const user = userEvent.setup();
    const { container } = renderSelect({ defaultOpen: true });
    await user.keyboard("{ArrowDown}");
    expect(await axe(container)).toHaveNoViolations();
  });
});
