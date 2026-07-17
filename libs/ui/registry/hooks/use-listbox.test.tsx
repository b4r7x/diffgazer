// biome-ignore-all lint/a11y/useFocusableInteractive: test harness builds a WAI-ARIA activedescendant listbox; option items stay non-focusable while the container holds focus.
// biome-ignore-all lint/a11y/useAriaPropsSupportedByRole: the harness sets role/aria via dynamic props that Biome cannot statically resolve to the listbox/option roles that support them.
// biome-ignore-all lint/a11y/noStaticElementInteractions: container keyboard handling is centralized on the listbox; option divs delegate activation to it.
// biome-ignore-all lint/a11y/useKeyWithClickEvents: option click activation is paired with the listbox container's centralized key handling, not per-item key handlers.
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { axe } from "../../testing/axe";
import { listboxDoc } from "../hook-docs/listbox";
import { requireAttribute } from "../testing/assertions";
import {
  getEncodedListboxItemId,
  type UseListboxOptions,
  type UseListboxReturn,
  useListbox,
} from "./use-listbox";

type ListboxItem = { id: string; label: string; disabled?: boolean };

function Listbox(
  props: Omit<Partial<UseListboxOptions>, "items"> & {
    items: ListboxItem[];
    provideItemsMetadata?: boolean;
    accessibleName?: string;
    rootKey?: string;
  },
) {
  const {
    items,
    provideItemsMetadata = true,
    accessibleName = "Test listbox",
    rootKey,
    ...opts
  } = props;
  const hookItems = provideItemsMetadata
    ? items.map((item) => ({ id: item.id, disabled: item.disabled }))
    : undefined;
  const { selectedId, handleItemActivate, getContainerProps } = useListbox({
    idPrefix: "lb",
    ...(hookItems === undefined ? {} : { items: hookItems }),
    ...opts,
  });
  const getDomItemId = opts.getItemId ?? getEncodedListboxItemId;

  return (
    <div key={rootKey} {...getContainerProps()} aria-label={accessibleName}>
      {items.map((item) => (
        <div
          key={item.id}
          id={getDomItemId("lb", item.id)}
          role={opts.itemRole ?? "option"}
          data-value={item.id}
          aria-selected={selectedId === item.id}
          aria-disabled={item.disabled || undefined}
          onClick={() => !item.disabled && handleItemActivate(item.id)}
        >
          {item.label}
        </div>
      ))}
    </div>
  );
}

const defaultItems = [
  { id: "a", label: "Alpha" },
  { id: "b", label: "Beta" },
  { id: "c", label: "Charlie" },
];

type EditableControlKind = "input" | "textarea" | "contenteditable";

function EditableControl({ kind }: { kind: EditableControlKind }) {
  if (kind === "input") return <input aria-label="Editable child" />;
  if (kind === "textarea") return <textarea aria-label="Editable child" />;
  return (
    // biome-ignore lint/a11y/useSemanticElements: contenteditable has no native element equivalent and needs textbox semantics.
    <div contentEditable role="textbox" aria-label="Editable child" suppressContentEditableWarning>
      edit
    </div>
  );
}

function ListboxWithEditableChild({
  kind,
  onHighlightChange,
}: {
  kind: EditableControlKind;
  onHighlightChange: (id: string | null) => void;
}) {
  const { getContainerProps } = useListbox({
    idPrefix: "editable",
    defaultHighlighted: "alpha",
    typeahead: true,
    onHighlightChange,
  });

  return (
    <div {...getContainerProps()} aria-label="Editable listbox">
      <EditableControl kind={kind} />
      <div id="editable-alpha" role="option" data-value="alpha">
        Alpha
      </div>
      <div id="editable-beta" role="option" data-value="beta">
        Beta
      </div>
    </div>
  );
}

function ListboxWithEditableItem({
  onHighlightChange,
}: {
  onHighlightChange: (id: string | null) => void;
}) {
  const { getContainerProps } = useListbox({
    idPrefix: "editable-item",
    defaultHighlighted: "alpha",
    typeahead: true,
    onHighlightChange,
  });

  return (
    <div {...getContainerProps()} aria-label="Editable item listbox">
      <div id="editable-item-alpha" role="option" data-value="alpha">
        Alpha
      </div>
      <div
        id="editable-item-beta"
        role="option"
        data-value="beta"
        contentEditable
        suppressContentEditableWarning
      >
        Beta
      </div>
    </div>
  );
}

function ListboxWithShadowEditable({
  owned,
  onHighlightChange,
}: {
  owned: boolean;
  onHighlightChange: (id: string | null) => void;
}) {
  const { getContainerProps } = useListbox({
    idPrefix: "shadow-editable",
    defaultHighlighted: "alpha",
    typeahead: true,
    onHighlightChange,
  });
  const shadowInputHost = (
    <span
      data-testid="shadow-editable-host"
      ref={(host) => {
        if (!host || host.shadowRoot) return;
        const input = document.createElement("input");
        input.setAttribute("aria-label", "Shadow editable");
        host.attachShadow({ mode: "open" }).append(input);
      }}
    />
  );

  return (
    <div {...getContainerProps()} aria-label="Shadow editable listbox">
      {!owned && shadowInputHost}
      <div id="shadow-editable-alpha" role="option" data-value="alpha">
        Alpha
      </div>
      <div id="shadow-editable-beta" role="option" data-value="beta">
        Beta
        {owned && shadowInputHost}
      </div>
    </div>
  );
}

describe("useListbox", () => {
  it("renders with listbox role and tabindex", () => {
    render(<Listbox items={defaultItems} />);
    const listbox = screen.getByRole("listbox");
    expect(listbox).toBeInTheDocument();
    expect(listbox).toHaveAttribute("tabindex", "0");
  });

  it("documents and renders a named listbox with no axe violations", async () => {
    expect(listboxDoc.usage?.code).toContain('aria-label="Fruit choices"');
    const { container } = render(<Listbox items={defaultItems} accessibleName="Fruit choices" />);
    expect(screen.getByRole("listbox", { name: "Fruit choices" })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("focuses the autoFocus listbox on mount but not on later re-renders while focus is elsewhere", async () => {
    const { rerender } = render(
      <>
        <Listbox items={defaultItems} autoFocus />
        <button type="button">Outside</button>
      </>,
    );

    const listbox = screen.getByRole("listbox");
    await waitFor(() => expect(listbox).toHaveFocus());

    // Move focus out, then re-render with new inline option labels and handlers.
    const outside = screen.getByRole("button", { name: "Outside" });
    outside.focus();
    expect(outside).toHaveFocus();

    rerender(
      <>
        <Listbox
          items={[
            { id: "a", label: "Alpha!" },
            { id: "b", label: "Beta!" },
            { id: "c", label: "Charlie!" },
          ]}
          autoFocus
          onHighlightChange={() => {}}
        />
        <button type="button">Outside</button>
      </>,
    );

    // A re-render with a still-true autoFocus must NOT re-steal focus.
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
    });
    expect(screen.getByRole("button", { name: "Outside" })).toHaveFocus();
  });

  it("does not detach/re-attach the container ref on benign re-renders", () => {
    const attachSpy = vi.fn();
    // A stable consumer ref, like the useComposedRefs(menuRef, ref) callers pass.
    const refCallback = (node: HTMLDivElement | null) => {
      attachSpy(node);
    };

    const { rerender } = render(<Listbox items={defaultItems} ref={refCallback} />);

    const listbox = screen.getByRole("listbox");
    expect(attachSpy).toHaveBeenCalledTimes(1);
    expect(attachSpy).toHaveBeenLastCalledWith(listbox);

    // A re-render with new inline handlers must not re-run the ref (no detach/re-attach).
    rerender(<Listbox items={defaultItems} onHighlightChange={() => {}} ref={refCallback} />);
    expect(attachSpy).toHaveBeenCalledTimes(1);
  });

  it("supports menu role", async () => {
    render(<Listbox items={defaultItems} role="menu" itemRole="menuitem" />);
    const menu = screen.getByRole("menu");
    expect(menu).toBeInTheDocument();
    expect(screen.getAllByRole("menuitem")).toHaveLength(3);
  });

  it("supports controlled selectedId", () => {
    render(<Listbox items={defaultItems} selectedId="b" />);
    const listbox = screen.getByRole("listbox");
    expect(listbox).toHaveAttribute("aria-activedescendant", getEncodedListboxItemId("lb", "b"));
  });

  it("removes aria-activedescendant when the active item is removed", async () => {
    const { rerender } = render(<Listbox items={defaultItems} selectedId="b" />);
    const listbox = screen.getByRole("listbox");
    expect(listbox).toHaveAttribute("aria-activedescendant", getEncodedListboxItemId("lb", "b"));

    rerender(<Listbox items={defaultItems.filter((item) => item.id !== "b")} selectedId="b" />);
    await waitFor(() => expect(listbox).not.toHaveAttribute("aria-activedescendant"));
  });

  it("removes aria-activedescendant when the active item is removed without item metadata", async () => {
    const { rerender } = render(
      <Listbox items={defaultItems} selectedId="b" provideItemsMetadata={false} />,
    );
    const listbox = screen.getByRole("listbox");
    await waitFor(() =>
      expect(listbox).toHaveAttribute("aria-activedescendant", getEncodedListboxItemId("lb", "b")),
    );

    rerender(
      <Listbox
        items={defaultItems.filter((item) => item.id !== "b")}
        selectedId="b"
        provideItemsMetadata={false}
      />,
    );
    await waitFor(() => expect(listbox).not.toHaveAttribute("aria-activedescendant"));
  });

  it("moves DOM validation to a keyed replacement root before observing option removal", async () => {
    const { rerender } = render(
      <Listbox rootKey="first" items={defaultItems} selectedId="b" provideItemsMetadata={false} />,
    );
    const firstRoot = screen.getByRole("listbox");
    await waitFor(() =>
      expect(firstRoot).toHaveAttribute(
        "aria-activedescendant",
        getEncodedListboxItemId("lb", "b"),
      ),
    );

    rerender(
      <Listbox rootKey="second" items={defaultItems} selectedId="b" provideItemsMetadata={false} />,
    );
    const replacementRoot = screen.getByRole("listbox");
    expect(replacementRoot).not.toBe(firstRoot);

    rerender(
      <Listbox
        rootKey="second"
        items={defaultItems.filter((item) => item.id !== "b")}
        selectedId="b"
        provideItemsMetadata={false}
      />,
    );

    await waitFor(() => expect(replacementRoot).not.toHaveAttribute("aria-activedescendant"));
  });

  it("does not activate a removed highlighted item", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <Listbox items={defaultItems} highlighted="b" onSelect={onSelect} />,
    );

    rerender(
      <Listbox
        items={defaultItems.filter((item) => item.id !== "b")}
        highlighted="b"
        onSelect={onSelect}
      />,
    );
    screen.getByRole("listbox").focus();
    await user.keyboard("{Enter}");

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("forwards custom onKeyDown handler with the keyboard event", async () => {
    const onKeyDown = vi.fn();
    const user = userEvent.setup();
    render(<Listbox items={defaultItems} onKeyDown={onKeyDown} />);

    const listbox = screen.getByRole("listbox");
    listbox.focus();
    await user.keyboard("{ArrowDown}");

    expect(onKeyDown).toHaveBeenCalledWith(expect.objectContaining({ key: "ArrowDown" }));
  });

  it("selects item on click and fires onSelect", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<Listbox items={defaultItems} onSelect={onSelect} />);

    const option = screen.getByText("Beta");
    await user.click(option);

    expect(onSelect).toHaveBeenCalledWith("b");
    expect(option).toHaveAttribute("aria-selected", "true");
  });

  it("skips aria-disabled items in typeahead", async () => {
    const items = [
      { id: "d", label: "Disabled", disabled: true },
      { id: "a", label: "Alpha" },
      { id: "b", label: "Beta" },
    ];
    const onHighlight = vi.fn();
    const user = userEvent.setup();
    render(<Listbox items={items} typeahead onHighlightChange={onHighlight} />);

    const listbox = screen.getByRole("listbox");
    listbox.focus();
    await user.keyboard("a");

    expect(onHighlight).toHaveBeenLastCalledWith("a");
  });

  it("extends the typeahead query with Space and does not select while the buffer is non-empty", async () => {
    const items = [
      { id: "ny", label: "New York" },
      { id: "nj", label: "New Jersey" },
    ];
    const onHighlight = vi.fn();
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<Listbox items={items} typeahead onHighlightChange={onHighlight} onSelect={onSelect} />);

    const listbox = screen.getByRole("listbox");
    listbox.focus();
    await user.keyboard("new y");

    expect(onHighlight).toHaveBeenLastCalledWith("ny");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("selects the highlighted item on Space while the typeahead buffer is empty", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<Listbox items={defaultItems} typeahead highlighted="b" onSelect={onSelect} />);

    const listbox = screen.getByRole("listbox");
    listbox.focus();
    await user.keyboard(" ");

    expect(onSelect).toHaveBeenCalledWith("b");
  });

  it("includes disabled menu items in typeahead focus without activating them", async () => {
    const onHighlight = vi.fn();
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <Listbox
        role="menu"
        itemRole="menuitem"
        items={[
          { id: "disabled-beta", label: "Beta", disabled: true },
          { id: "bravo", label: "Bravo" },
        ]}
        typeahead
        onHighlightChange={onHighlight}
        onSelect={onSelect}
      />,
    );

    const menu = screen.getByRole("menu");
    menu.focus();
    await user.keyboard("b{Enter}");

    expect(onHighlight).toHaveBeenCalledWith("disabled-beta");
    expect(menu).toHaveAttribute(
      "aria-activedescendant",
      getEncodedListboxItemId("lb", "disabled-beta"),
    );
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("keeps typeahead scoped away from nested listboxes", async () => {
    const onHighlight = vi.fn();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const user = userEvent.setup({
      delay: null,
      advanceTimers: (delay) => {
        vi.advanceTimersByTime(delay);
      },
    });
    const keyboard = async (text: string) => {
      const typing = user.keyboard(text);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      await typing;
    };

    function NestedListbox() {
      const { getContainerProps } = useListbox({
        idPrefix: "outer",
        onHighlightChange: onHighlight,
        typeahead: true,
      });

      return (
        <div {...getContainerProps()} aria-label="Outer">
          <div id="outer-alpha" role="option" data-value="alpha">
            Alpha
          </div>
          <div role="listbox" aria-label="Nested">
            <div id="outer-beta" role="option" data-value="beta">
              Beta
            </div>
          </div>
          <div id="outer-charlie" role="option" data-value="charlie">
            Charlie
          </div>
        </div>
      );
    }

    try {
      render(<NestedListbox />);
      screen.getByRole("listbox", { name: "Outer" }).focus();
      await keyboard("b");

      expect(onHighlight).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(600);
      });
      await keyboard("c");
      expect(onHighlight).toHaveBeenCalledWith("charlie");
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it("does not update outer typeahead when key bubbles from a focused inner composite", async () => {
    const onHighlight = vi.fn();
    const user = userEvent.setup();

    function NestedFocusableListbox() {
      const { getContainerProps } = useListbox({
        idPrefix: "outer",
        onHighlightChange: onHighlight,
        typeahead: true,
      });

      return (
        <div {...getContainerProps()} aria-label="Outer">
          <div id="outer-alpha" role="option" data-value="alpha">
            Alpha
          </div>
          <div role="listbox" aria-label="Nested" tabIndex={0}>
            <div id="outer-beta" role="option" data-value="beta">
              Beta
            </div>
          </div>
          <div id="outer-charlie" role="option" data-value="charlie">
            Charlie
          </div>
        </div>
      );
    }

    render(<NestedFocusableListbox />);
    screen.getByRole("listbox", { name: "Nested" }).focus();
    await user.keyboard("c");

    expect(onHighlight).not.toHaveBeenCalled();
  });

  it("does not update outer typeahead from an editable shadow descendant of an inner composite", async () => {
    const onHighlight = vi.fn();

    function NestedShadowListbox() {
      const { getContainerProps } = useListbox({
        idPrefix: "outer-shadow",
        defaultHighlighted: "alpha",
        onHighlightChange: onHighlight,
        typeahead: true,
      });

      return (
        <div {...getContainerProps()} aria-label="Outer shadow listbox">
          <div id="outer-shadow-alpha" role="option" data-value="alpha">
            Alpha
            <div role="listbox" aria-label="Inner shadow listbox">
              <div role="option" data-value="inner">
                Inner
                <span
                  data-testid="nested-shadow-input-host"
                  ref={(host) => {
                    if (!host || host.shadowRoot) return;
                    const input = document.createElement("input");
                    input.setAttribute("aria-label", "Nested shadow input");
                    host.attachShadow({ mode: "open" }).append(input);
                  }}
                />
              </div>
            </div>
          </div>
          <div id="outer-shadow-charlie" role="option" data-value="charlie">
            Charlie
          </div>
        </div>
      );
    }

    render(<NestedShadowListbox />);
    const input = screen.getByTestId("nested-shadow-input-host").shadowRoot?.querySelector("input");
    expect(input).not.toBeNull();
    if (!input) return;
    input.focus();

    await userEvent.setup().keyboard("c");

    expect(onHighlight).not.toHaveBeenCalled();
    expect(screen.getByRole("listbox", { name: "Outer shadow listbox" })).toHaveAttribute(
      "aria-activedescendant",
      "outer-shadow-alpha",
    );
  });

  it.each([
    "input",
    "textarea",
    "contenteditable",
  ] as const)("does not run typeahead for printable input bubbling from an editable %s descendant", async (kind) => {
    const onHighlight = vi.fn();
    render(<ListboxWithEditableChild kind={kind} onHighlightChange={onHighlight} />);
    const editable = screen.getByRole("textbox", { name: "Editable child" });
    editable.focus();

    await userEvent.setup().keyboard("b");

    expect(onHighlight).not.toHaveBeenCalled();
    expect(screen.getByRole("listbox", { name: "Editable listbox" })).toHaveAttribute(
      "aria-activedescendant",
      "editable-alpha",
    );
  });

  it("retains typeahead when the editable target is itself an owned option", async () => {
    const onHighlight = vi.fn();
    render(<ListboxWithEditableItem onHighlightChange={onHighlight} />);
    const editableOption = screen.getByRole("option", { name: "Beta" });
    editableOption.focus();

    await userEvent.setup().keyboard("b");

    expect(onHighlight).toHaveBeenCalledWith("beta");
  });

  it("retains typeahead for an editable open-shadow descendant of an owned option", async () => {
    const onHighlight = vi.fn();
    render(<ListboxWithShadowEditable owned onHighlightChange={onHighlight} />);
    const input = screen.getByTestId("shadow-editable-host").shadowRoot?.querySelector("input");
    expect(input).not.toBeNull();
    if (!input) return;
    input.focus();

    await userEvent.setup().keyboard("b");

    expect(onHighlight).toHaveBeenCalledWith("beta");
  });

  it("ignores typeahead from an editable open-shadow non-item", async () => {
    const onHighlight = vi.fn();
    render(<ListboxWithShadowEditable owned={false} onHighlightChange={onHighlight} />);
    const input = screen.getByTestId("shadow-editable-host").shadowRoot?.querySelector("input");
    expect(input).not.toBeNull();
    if (!input) return;
    input.focus();

    await userEvent.setup().keyboard("b");

    expect(onHighlight).not.toHaveBeenCalled();
    expect(screen.getByRole("listbox", { name: "Shadow editable listbox" })).toHaveAttribute(
      "aria-activedescendant",
      "shadow-editable-alpha",
    );
  });

  it("starts typeahead search after the current highlighted item", async () => {
    const items = [
      { id: "a1", label: "Alpha" },
      { id: "a2", label: "Apricot" },
      { id: "a3", label: "Avocado" },
    ];
    const onHighlight = vi.fn();
    const user = userEvent.setup();
    render(
      <Listbox items={items} defaultHighlighted="a1" typeahead onHighlightChange={onHighlight} />,
    );

    const listbox = screen.getByRole("listbox");
    listbox.focus();
    await user.keyboard("a");

    expect(onHighlight).toHaveBeenLastCalledWith("a2");
  });

  it("cycles through items sharing a prefix on repeated character press", async () => {
    const items = [
      { id: "s1", label: "Strawberry" },
      { id: "s2", label: "Sage" },
      { id: "s3", label: "Salmon" },
      { id: "o", label: "Orange" },
    ];
    const onHighlight = vi.fn();
    const user = userEvent.setup();
    render(<Listbox items={items} typeahead onHighlightChange={onHighlight} />);

    const listbox = screen.getByRole("listbox");
    listbox.focus();
    await user.keyboard("s");
    expect(onHighlight).toHaveBeenLastCalledWith("s1");

    await user.keyboard("s");
    expect(onHighlight).toHaveBeenLastCalledWith("s2");

    await user.keyboard("s");
    expect(onHighlight).toHaveBeenLastCalledWith("s3");

    await user.keyboard("s");
    expect(onHighlight).toHaveBeenLastCalledWith("s1");
  });

  it("uses aria-label text for typeahead matching", async () => {
    const onHighlight = vi.fn();
    const user = userEvent.setup();

    function LabelledListbox() {
      const { getContainerProps } = useListbox({
        idPrefix: "lb",
        typeahead: true,
        onHighlightChange: onHighlight,
      });

      return (
        <div {...getContainerProps()} aria-label="Test listbox">
          <div id="lb-icon" role="option" data-value="icon" aria-label="Zebra">
            Icon
          </div>
        </div>
      );
    }

    render(<LabelledListbox />);
    screen.getByRole("listbox").focus();
    await user.keyboard("z");

    expect(onHighlight).toHaveBeenCalledWith("icon");
  });

  it("uses aria-labelledby text for typeahead matching", async () => {
    const onHighlight = vi.fn();
    const user = userEvent.setup();

    function LabelledByListbox() {
      const { getContainerProps } = useListbox({
        idPrefix: "lb",
        typeahead: true,
        onHighlightChange: onHighlight,
      });

      return (
        <div {...getContainerProps()} aria-label="Test listbox">
          <span id="omega-label">Omega</span>
          <div id="lb-symbol" role="option" data-value="symbol" aria-labelledby="omega-label">
            Symbol
          </div>
        </div>
      );
    }

    render(<LabelledByListbox />);
    screen.getByRole("listbox").focus();
    await user.keyboard("o");

    expect(onHighlight).toHaveBeenCalledWith("symbol");
  });

  it("uses a directly referenced hidden label for typeahead", async () => {
    const onHighlight = vi.fn();
    const user = userEvent.setup();

    function HiddenLabelListbox() {
      const { getContainerProps } = useListbox({
        idPrefix: "lb",
        typeahead: true,
        onHighlightChange: onHighlight,
      });

      return (
        <div {...getContainerProps()} aria-label="Test listbox">
          <span id="hidden-omega-label" hidden>
            Omega
          </span>
          <div
            id="lb-symbol"
            role="option"
            data-value="symbol"
            aria-labelledby="hidden-omega-label"
          >
            Symbol
          </div>
        </div>
      );
    }

    render(<HiddenLabelListbox />);
    screen.getByRole("listbox").focus();
    await user.keyboard("o");

    expect(onHighlight).toHaveBeenCalledWith("symbol");
  });

  it("treats empty string as a valid selected and highlighted item id", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <Listbox
        items={[
          { id: "", label: "None" },
          { id: "a b/slash", label: "Special" },
        ]}
        defaultHighlighted=""
        onSelect={onSelect}
      />,
    );

    const listbox = screen.getByRole("listbox");
    expect(listbox).toHaveAttribute("aria-activedescendant", getEncodedListboxItemId("lb", ""));
    expect(document.getElementById(getEncodedListboxItemId("lb", ""))).toHaveTextContent("None");

    listbox.focus();
    await user.keyboard("{Enter}");

    expect(onSelect).toHaveBeenCalledWith("");
  });

  it("uses DOM-safe generated ids for special public values", () => {
    render(<Listbox items={[{ id: "a b/slash", label: "Special" }]} selectedId="a b/slash" />);

    const listbox = screen.getByRole("listbox");
    const activeDescendant = requireAttribute(listbox, "aria-activedescendant");
    expect(activeDescendant).toBe(getEncodedListboxItemId("lb", "a b/slash"));
    expect(activeDescendant).not.toContain(" ");
    expect(activeDescendant).not.toContain("/");
    expect(document.getElementById(activeDescendant)).toHaveTextContent("Special");
  });

  describe("types", () => {
    it("narrows selectedId/onSelect to the supplied union", () => {
      type Narrow = UseListboxOptions<"a" | "b">;
      type ReturnNarrow = UseListboxReturn<"a" | "b">;

      expectTypeOf<Narrow["selectedId"]>().toEqualTypeOf<"a" | "b" | null | undefined>();
      expectTypeOf<NonNullable<Narrow["onSelect"]>>().parameter(0).toEqualTypeOf<"a" | "b">();
      expectTypeOf<ReturnNarrow["selectedId"]>().toEqualTypeOf<"a" | "b" | null>();
    });

    it("keeps the loose default contract when no generic is supplied", () => {
      expectTypeOf<UseListboxOptions["selectedId"]>().toEqualTypeOf<string | null | undefined>();
      expectTypeOf<UseListboxReturn["selectedId"]>().toEqualTypeOf<string | null>();
    });
  });
});
