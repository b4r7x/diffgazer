import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Fragment } from "react";
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

describe("Select search position", () => {
  function renderSearchPositioned(position?: "top" | "bottom") {
    render(
      <Select variant="card" defaultOpen>
        <Select.Trigger>
          <Select.Value placeholder="Pick" />
        </Select.Trigger>
        <Select.Content>
          <Select.Search {...(position ? { position } : {})} />
          <Select.Item value="apple">Apple</Select.Item>
          <Select.Item value="banana">Banana</Select.Item>
        </Select.Content>
      </Select>,
    );
  }

  it("renders the search row after the listbox by default (bottom)", () => {
    renderSearchPositioned();
    const search = getSearchInput();
    const listbox = screen.getByRole("listbox");
    expect(listbox.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("renders the search row before the listbox when position='top'", () => {
    renderSearchPositioned("top");
    const search = getSearchInput();
    const listbox = screen.getByRole("listbox");
    expect(listbox.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });
});

describe("Select results live region", () => {
  it("mounts the status region before any query and swaps its text as the query changes", async () => {
    const user = userEvent.setup();
    renderSelect({ withSearch: true, defaultOpen: true });

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("");

    await user.type(getSearchInput(), "ban");
    expect(status).toHaveTextContent("1 results");

    await user.clear(getSearchInput());
    expect(status).toHaveTextContent("");
  });
});

describe("Select search filtering", () => {
  it("renders no empty state before a query, even when the option list is empty", () => {
    renderSelect({ withSearch: true, defaultOpen: true, items: [] });

    expect(getSearchInput()).toHaveValue("");
    expect(screen.queryByText("> no results.")).not.toBeInTheDocument();
  });

  it("filters items based on search query", async () => {
    const user = userEvent.setup();
    renderSelect({ withSearch: true });
    await user.click(getSelectTrigger());
    await user.type(getSearchInput(), "ban");
    expect(screen.getByText("Banana")).toBeInTheDocument();
    expect(screen.queryByText("Apple")).not.toBeInTheDocument();
    expect(screen.queryByText("Cherry")).not.toBeInTheDocument();
  });

  it("activates searchable default portalled options on mouse click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSelect({ variant: "default", withSearch: true, onChange });

    await user.click(getSelectTrigger());
    await user.type(getSearchInput(), "ban");
    await user.click(screen.getByRole("option", { name: /banana/i }));

    expect(onChange).toHaveBeenCalledWith("banana");
    expect(getSelectTrigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("shows empty state when search has no matches", async () => {
    const user = userEvent.setup();
    renderSelect({ withSearch: true });
    await user.click(getSelectTrigger());
    await user.type(getSearchInput(), "zzz");
    expect(screen.getByText("> no results.")).toBeInTheDocument();
  });

  it("keeps Select.Empty outside the searchable listbox", async () => {
    const user = userEvent.setup();
    renderSelect({ withSearch: true, defaultOpen: true });
    const listbox = screen.getByRole("listbox");
    await user.type(getSearchInput(), "zzz");
    expect(listbox).not.toContainElement(screen.getByText("> no results."));
  });

  it("does not activate a filtered-out highlighted option", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSelect({ withSearch: true, defaultOpen: true, highlighted: "banana", onChange });

    await user.type(getSearchInput(), "zzz");
    await user.keyboard("{Enter}");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps Home and End available for text editing in searchable input", async () => {
    const user = userEvent.setup();
    const onHighlightChange = vi.fn();
    renderSelectInline({
      defaultOpen: true,
      highlighted: "banana",
      onHighlightChange,
      children: (
        <>
          <Select.Search />
          <Select.Item value="apple">Apple</Select.Item>
          <Select.Item value="banana">Banana</Select.Item>
          <Select.Item value="cherry">Cherry</Select.Item>
        </>
      ),
    });

    onHighlightChange.mockClear();
    await user.type(getSearchInput(), "{Home}{End}");
    expect(onHighlightChange).not.toHaveBeenCalled();
  });

  it("keeps searchable input outside listbox ownership", () => {
    renderSelect({ withSearch: true, defaultOpen: true });
    expect(screen.getByRole("listbox")).not.toContainElement(getSearchInput());
  });

  it("keeps wrapped searchable inputs outside listbox ownership", () => {
    renderSelectInline({
      defaultOpen: true,
      children: (
        <>
          {/* biome-ignore lint/complexity/noUselessFragments: the Fragment wrapper is intentional — this test asserts that Fragment-wrapped Select.Search inputs stay outside listbox ownership. */}
          <Fragment>
            <Select.Search />
          </Fragment>
          <div>
            <Select.Search aria-label="Filter options" />
          </div>
          <Select.Item value="apple">Apple</Select.Item>
        </>
      ),
    });
    const listbox = screen.getByRole("listbox");

    expect(listbox).not.toContainElement(getSearchInput());
    expect(listbox).not.toContainElement(screen.getByRole("combobox", { name: /filter options/i }));
  });

  it("preserves a DOM wrapper around hoisted Search and Empty children", async () => {
    const user = userEvent.setup();
    renderSelectInline({
      defaultOpen: true,
      children: (
        <div data-testid="search-only-wrapper">
          <Select.Search />
          <Select.Empty>No matches</Select.Empty>
        </div>
      ),
    });

    await user.type(getSearchInput(), "missing");

    const listbox = screen.getByRole("listbox");
    const wrappers = screen.getAllByTestId("search-only-wrapper");
    const searchWrapper = getSearchInput().closest<HTMLElement>(
      '[data-testid="search-only-wrapper"]',
    );
    const emptyWrapper = screen
      .getByText("No matches")
      .closest<HTMLElement>('[data-testid="search-only-wrapper"]');

    expect(wrappers).toHaveLength(2);
    expect(searchWrapper).not.toBeNull();
    expect(emptyWrapper).not.toBeNull();
    expect(listbox).not.toContainElement(searchWrapper);
    expect(listbox).not.toContainElement(emptyWrapper);
  });

  it("clones a mixed DOM wrapper for hoisted parts and listbox options", async () => {
    const user = userEvent.setup();
    renderSelectInline({
      defaultOpen: true,
      children: (
        <section data-testid="mixed-select-wrapper">
          <Select.Search position="top" />
          <Select.Item value="apple">Apple</Select.Item>
          <Select.Empty>No matching fruit</Select.Empty>
        </section>
      ),
    });

    const listbox = screen.getByRole("listbox");
    const option = screen.getByRole("option", { name: "Apple" });
    const searchWrapper = getSearchInput().closest<HTMLElement>(
      '[data-testid="mixed-select-wrapper"]',
    );
    const optionWrapper = option.closest<HTMLElement>('[data-testid="mixed-select-wrapper"]');

    expect(searchWrapper).not.toBeNull();
    expect(optionWrapper).not.toBeNull();
    expect(listbox).not.toContainElement(searchWrapper);
    expect(listbox).toContainElement(optionWrapper);

    await user.type(getSearchInput(), "missing");
    const emptyWrapper = screen
      .getByText("No matching fruit")
      .closest<HTMLElement>('[data-testid="mixed-select-wrapper"]');
    expect(emptyWrapper).not.toBeNull();
    expect(listbox).not.toContainElement(emptyWrapper);
    expect(screen.getAllByTestId("mixed-select-wrapper")).toHaveLength(3);
  });

  it("assigns wrapper identity and ARIA semantics to only one partition", async () => {
    const user = userEvent.setup();
    const { container } = renderSelectInline({
      defaultOpen: true,
      children: (
        // biome-ignore lint/a11y/useSemanticElements: a generic wrapper verifies that secondary clones lose explicit semantics; fieldset would keep an implicit group role.
        <section
          id="partitioned-select-wrapper"
          role="group"
          aria-label="Partitioned fruit"
          tabIndex={-1}
          className="consumer-wrapper"
          data-testid="semantic-select-wrapper"
        >
          <Select.Search />
          <Select.Item value="apple">Apple</Select.Item>
          <Select.Empty>No matching fruit</Select.Empty>
        </section>
      ),
    });

    const semanticWrapper = screen.getByRole("group", { name: "Partitioned fruit" });
    expect(semanticWrapper).toContainElement(screen.getByRole("option", { name: "Apple" }));

    await user.type(getSearchInput(), "missing");

    const wrappers = screen.getAllByTestId("semantic-select-wrapper");
    expect(wrappers).toHaveLength(3);
    expect(container.querySelectorAll("#partitioned-select-wrapper")).toHaveLength(1);
    expect(semanticWrapper).toHaveAttribute("id", "partitioned-select-wrapper");
    for (const wrapper of wrappers) {
      expect(wrapper).toHaveClass("consumer-wrapper");
      if (wrapper === semanticWrapper) continue;
      expect(wrapper).not.toHaveAttribute("id");
      expect(wrapper).not.toHaveAttribute("role");
      expect(wrapper).not.toHaveAttribute("aria-label");
      expect(wrapper).not.toHaveAttribute("tabindex");
    }
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Select searchable combobox controlled value", () => {
  it("treats explicit undefined value as controlled for searchable combobox", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Select value={undefined} onChange={onChange} defaultOpen>
        <Select.Trigger>
          <Select.Value placeholder={PICK_FRUIT} />
        </Select.Trigger>
        <Select.Content>
          <Select.Search />
          <Select.Item value="apple">Apple</Select.Item>
          <Select.Item value="banana">Banana</Select.Item>
        </Select.Content>
      </Select>,
    );

    expect(screen.getByText(PICK_FRUIT)).toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: /banana/i }));
    expect(onChange).toHaveBeenCalledWith("banana");
    expect(screen.getByText(PICK_FRUIT)).toBeInTheDocument();
  });
});

describe("Select unified label derivation (JSX children)", () => {
  function renderComposite(onChange = vi.fn()) {
    render(
      <Select defaultOpen onChange={onChange}>
        <Select.Trigger>
          <Select.Value placeholder={PICK_FRUIT} />
        </Select.Trigger>
        <Select.Content>
          <Select.Search />
          <Select.Item value="fruit-a">
            <span aria-hidden="true">🍎</span>
            <span>Apple</span>
          </Select.Item>
          <Select.Item value="fruit-b">
            <span aria-hidden="true">🍌</span>
            <span>Banana</span>
          </Select.Item>
        </Select.Content>
      </Select>,
    );
    return onChange;
  }

  it("filters, highlights, counts, and commits by the visible JSX text without textValue", async () => {
    const user = userEvent.setup();
    const onChange = renderComposite();
    const searchInput = getSearchInput();

    await user.type(searchInput, "banana");

    const bananaOption = screen.getByRole("option", { name: /banana/i });
    expect(screen.getAllByRole("option")).toEqual([bananaOption]);
    expect(searchInput).toHaveAttribute("aria-activedescendant", bananaOption.id);
    expect(screen.getByRole("status")).toHaveTextContent("1 results");

    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("fruit-b");
  });

  it("does not match the raw value string and never points activedescendant at an unmounted node", async () => {
    const user = userEvent.setup();
    renderComposite();
    const searchInput = getSearchInput();

    await user.type(searchInput, "banana");
    const active = searchInput.getAttribute("aria-activedescendant");
    expect(active).toBeTruthy();
    expect(document.getElementById(active as string)).not.toBeNull();

    await user.clear(searchInput);
    await user.type(searchInput, "apple");
    expect(screen.queryByRole("option", { name: /apple/i })).toBeInTheDocument();
    await user.clear(searchInput);
    await user.type(searchInput, "fruit-a");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    const stale = searchInput.getAttribute("aria-activedescendant");
    if (stale) expect(document.getElementById(stale)).not.toBeNull();
  });
});
