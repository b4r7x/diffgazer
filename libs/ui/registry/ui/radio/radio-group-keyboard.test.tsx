import { toVerticalBoundaryDirection } from "@diffgazer/keys";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RadioGroup } from "./index";

describe("RadioGroup keyboard navigation", () => {
  it.each([
    { defaultValue: "blue", expected: "Blue", label: "default-selected item" },
    { defaultValue: undefined, expected: "Blue", label: "first enabled fallback" },
  ])("renders the $label as the only server Tab stop", ({ defaultValue, expected }) => {
    const markup = renderToString(
      <RadioGroup label="Colors" defaultValue={defaultValue}>
        <RadioGroup.Item value="red" label="Red" disabled />
        <RadioGroup.Item value="blue" label="Blue" />
        <RadioGroup.Item value="green" label="Green" />
      </RadioGroup>,
    );
    const container = document.createElement("div");
    container.innerHTML = markup;
    const radios = within(container).getAllByRole("radio");
    const tabbable = radios.filter((radio) => radio.getAttribute("tabindex") === "0");

    expect(tabbable).toHaveLength(1);
    expect(tabbable[0]).toHaveTextContent(expected);
  });

  it("keeps a visible radio as the only Tab stop when the selected item is CSS-hidden", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <>
        <style>{`.css-hidden-radio { display: none; }`}</style>
        <button type="button">Before</button>
        <RadioGroup label="Colors" value="red">
          <div className="css-hidden-radio">
            <RadioGroup.Item value="red" label="Red" />
          </div>
          <RadioGroup.Item value="blue" label="Blue" />
        </RadioGroup>
        <button type="button">After</button>
      </>,
    );
    const red = container.querySelector<HTMLElement>('[role="radio"][data-value="red"]');
    const blue = screen.getByRole("radio", { name: "Blue" });
    if (!red) throw new Error("Expected CSS-hidden red radio");

    await waitFor(() => {
      expect(red).toHaveAttribute("tabindex", "-1");
      expect(blue).toHaveAttribute("tabindex", "0");
    });

    screen.getByRole("button", { name: "Before" }).focus();
    await user.tab();
    expect(blue).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();

    await user.tab({ shift: true });
    expect(blue).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Before" })).toHaveFocus();
  });

  it("resyncs the RadioGroup Tab target when an ancestor class changes visibility", async () => {
    function VisibilityGroup({ hideSelected }: { hideSelected: boolean }) {
      return (
        <>
          <style>{`.css-hidden-radio { display: none; }`}</style>
          <RadioGroup label="Colors" value="red">
            <div className={hideSelected ? "css-hidden-radio" : undefined}>
              <RadioGroup.Item value="red" label="Red" />
            </div>
            <RadioGroup.Item value="blue" label="Blue" />
          </RadioGroup>
        </>
      );
    }

    const { rerender } = render(<VisibilityGroup hideSelected={false} />);
    const red = screen.getByRole("radio", { name: "Red" });
    const blue = screen.getByRole("radio", { name: "Blue" });
    expect(red).toHaveAttribute("tabindex", "0");
    expect(blue).toHaveAttribute("tabindex", "-1");

    rerender(<VisibilityGroup hideSelected />);
    await waitFor(() => {
      expect(red).toHaveAttribute("tabindex", "-1");
      expect(blue).toHaveAttribute("tabindex", "0");
    });

    rerender(<VisibilityGroup hideSelected={false} />);
    await waitFor(() => {
      expect(red).toHaveAttribute("tabindex", "0");
      expect(blue).toHaveAttribute("tabindex", "-1");
    });
  });

  it("does not move keyboard highlight on mouse hover", async () => {
    const user = userEvent.setup();
    const onHighlight = vi.fn();
    render(
      <RadioGroup label="Colors" highlighted="red" onHighlightChange={onHighlight}>
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>,
    );

    await user.hover(screen.getByRole("radio", { name: /blue/i }));

    expect(onHighlight).not.toHaveBeenCalled();
    expect(screen.getByRole("radio", { name: /red/i })).toHaveAttribute("data-highlighted");
    expect(screen.getByRole("radio", { name: /blue/i })).not.toHaveAttribute("data-highlighted");
  });

  it("wraps across enabled radios, skips disabled items, and maps navigation keys", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onNavigate = vi.fn();
    render(
      <RadioGroup label="Colors" onChange={onChange} onNavigate={onNavigate}>
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" disabled />
        <RadioGroup.Item value="green" label="Green" />
      </RadioGroup>,
    );

    const red = screen.getByRole("radio", { name: /red/i });
    const blue = screen.getByRole("radio", { name: /blue/i });
    const green = screen.getByRole("radio", { name: /green/i });

    red.focus();
    await user.keyboard("{ArrowDown}");
    expect(green).toHaveFocus();
    expect(green).toHaveAttribute("aria-checked", "true");
    expect(onChange).toHaveBeenLastCalledWith("green");
    expect(onNavigate).toHaveBeenLastCalledWith("green", "next");

    await user.keyboard("{ArrowDown}");
    expect(red).toHaveFocus();
    expect(onNavigate).toHaveBeenLastCalledWith("red", "next");

    await user.keyboard("{ArrowUp}");
    expect(green).toHaveFocus();
    expect(onNavigate).toHaveBeenLastCalledWith("green", "previous");

    await user.keyboard("{Home}");
    expect(red).toHaveFocus();
    expect(onNavigate).toHaveBeenLastCalledWith("red", "first");

    await user.keyboard("{End}");
    expect(green).toHaveFocus();
    expect(onNavigate).toHaveBeenLastCalledWith("green", "last");

    await user.keyboard("{ArrowLeft}");
    expect(red).toHaveFocus();
    expect(onNavigate).toHaveBeenLastCalledWith("red", "previous");

    await user.keyboard("{ArrowRight}");
    expect(green).toHaveFocus();
    expect(onNavigate).toHaveBeenLastCalledWith("green", "next");
    expect(blue).not.toHaveFocus();
    expect(blue).toHaveAttribute("aria-checked", "false");
  });

  it("moves the selection with the j and k vim aliases", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onNavigate = vi.fn();
    render(
      <RadioGroup label="Colors" defaultValue="red" onChange={onChange} onNavigate={onNavigate}>
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>,
    );

    const red = screen.getByRole("radio", { name: /red/i });
    const blue = screen.getByRole("radio", { name: /blue/i });

    red.focus();
    await user.keyboard("j");
    expect(blue).toHaveFocus();
    expect(blue).toHaveAttribute("aria-checked", "true");
    expect(onChange).toHaveBeenLastCalledWith("blue");
    expect(onNavigate).toHaveBeenLastCalledWith("blue", "next");

    await user.keyboard("k");
    expect(red).toHaveFocus();
    expect(red).toHaveAttribute("aria-checked", "true");
    expect(onChange).toHaveBeenLastCalledWith("red");
    expect(onNavigate).toHaveBeenLastCalledWith("red", "previous");
  });

  it("types j and k into a nested text input instead of navigating", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RadioGroup label="Credential" defaultValue="paste" onChange={onChange}>
        <RadioGroup.Item value="paste" label="Paste key now" />
        <input aria-label="API key" />
        <RadioGroup.Item value="env" label="Import from env" />
      </RadioGroup>,
    );

    const input = screen.getByRole("textbox", { name: "API key" });
    await user.click(input);
    await user.keyboard("jk");

    expect(input).toHaveValue("jk");
    expect(input).toHaveFocus();
    expect(screen.getByRole("radio", { name: /paste key now/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it("lets a consumer onKeyDown handler suppress the built-in arrow navigation", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onKeyDown = vi.fn((event: ReactKeyboardEvent) => event.preventDefault());
    render(
      <RadioGroup label="Colors" defaultValue="red" onChange={onChange} onKeyDown={onKeyDown}>
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>,
    );

    const red = screen.getByRole("radio", { name: /red/i });
    red.focus();
    await user.keyboard("{ArrowDown}");

    expect(onKeyDown).toHaveBeenCalledWith(expect.objectContaining({ key: "ArrowDown" }));
    expect(red).toHaveFocus();
    expect(red).toHaveAttribute("aria-checked", "true");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("reports non-wrapping keyboard boundaries without moving focus", async () => {
    const user = userEvent.setup();
    const onNavigationBoundaryReached = vi.fn();
    render(
      <RadioGroup
        label="Colors"
        defaultValue="red"
        wrap={false}
        onNavigationBoundaryReached={onNavigationBoundaryReached}
      >
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>,
    );

    const red = screen.getByRole("radio", { name: /red/i });
    const blue = screen.getByRole("radio", { name: /blue/i });

    red.focus();
    await user.keyboard("{ArrowUp}");
    expect(onNavigationBoundaryReached).toHaveBeenLastCalledWith(
      "previous",
      expect.any(KeyboardEvent),
      "ArrowUp",
    );
    expect(red).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect(onNavigationBoundaryReached).toHaveBeenLastCalledWith(
      "previous",
      expect.any(KeyboardEvent),
      "ArrowLeft",
    );
    expect(red).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(blue).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(onNavigationBoundaryReached).toHaveBeenLastCalledWith(
      "next",
      expect.any(KeyboardEvent),
      "ArrowDown",
    );
    expect(blue).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(onNavigationBoundaryReached).toHaveBeenLastCalledWith(
      "next",
      expect.any(KeyboardEvent),
      "ArrowRight",
    );
    expect(blue).toHaveFocus();
  });

  it("hands vertical zone transitions to k and j at the list edges", async () => {
    const user = userEvent.setup();
    const onZoneChange = vi.fn();
    render(
      <RadioGroup
        label="Colors"
        defaultValue="red"
        wrap={false}
        onNavigationBoundaryReached={(direction, event) => {
          // App zone owners filter the horizontal APG arrows out of vertical zone
          // transitions with this helper; the vim aliases must survive it.
          const verticalDirection = toVerticalBoundaryDirection(direction, event.key);
          if (verticalDirection !== null) onZoneChange(verticalDirection);
        }}
      >
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>,
    );

    const red = screen.getByRole("radio", { name: /red/i });
    const blue = screen.getByRole("radio", { name: /blue/i });

    red.focus();
    await user.keyboard("k");
    expect(onZoneChange).toHaveBeenLastCalledWith("up");
    expect(red).toHaveFocus();

    await user.keyboard("j");
    expect(blue).toHaveFocus();

    await user.keyboard("j");
    expect(onZoneChange).toHaveBeenLastCalledWith("down");
    expect(blue).toHaveFocus();

    onZoneChange.mockClear();
    await user.keyboard("{ArrowRight}");
    expect(onZoneChange).not.toHaveBeenCalled();
  });

  it("keeps arrow navigation scoped away from nested radio groups", async () => {
    const user = userEvent.setup();
    const onOuterChange = vi.fn();
    const onInnerChange = vi.fn();
    render(
      <RadioGroup label="Outer" onChange={onOuterChange}>
        <RadioGroup.Item value="outer-a" label="Outer A" />
        <RadioGroup label="Inner" onChange={onInnerChange}>
          <RadioGroup.Item value="inner-a" label="Inner A" />
        </RadioGroup>
        <RadioGroup.Item value="outer-b" label="Outer B" />
      </RadioGroup>,
    );

    screen.getByRole("radio", { name: /outer a/i }).focus();
    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("radio", { name: /outer b/i })).toHaveFocus();
    expect(onOuterChange).toHaveBeenCalledWith("outer-b");
    expect(onInnerChange).not.toHaveBeenCalled();
  });

  it("does not handle arrow events bubbling from a nested group with suspended keyboard navigation", async () => {
    const user = userEvent.setup();
    const onOuterChange = vi.fn();
    const onInnerChange = vi.fn();
    render(
      <RadioGroup label="Outer" onChange={onOuterChange}>
        <RadioGroup.Item value="outer-a" label="Outer A" />
        <RadioGroup label="Inner" onChange={onInnerChange} keyboardNavigation={false}>
          <RadioGroup.Item value="inner-a" label="Inner A" />
        </RadioGroup>
        <RadioGroup.Item value="outer-b" label="Outer B" />
      </RadioGroup>,
    );

    screen.getByRole("radio", { name: /inner a/i }).focus();
    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("radio", { name: /inner a/i })).toHaveFocus();
    expect(onOuterChange).not.toHaveBeenCalled();
    expect(onInnerChange).not.toHaveBeenCalled();
  });

  it("keeps the highlighted item tabbable during manual activation", () => {
    render(
      <RadioGroup label="Colors" value="red" highlighted="blue" activationMode="manual">
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>,
    );

    const red = screen.getByRole("radio", { name: /red/i });
    const blue = screen.getByRole("radio", { name: /blue/i });
    expect(red).toHaveAttribute("aria-checked", "true");
    expect(red).toHaveAttribute("tabindex", "-1");
    expect(blue).toHaveAttribute("tabindex", "0");
    expect(blue).toHaveAttribute("data-highlighted");
  });

  it("moves selection with ArrowDown", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RadioGroup onChange={onChange} label="Colors">
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
        <RadioGroup.Item value="green" label="Green" />
      </RadioGroup>,
    );
    const red = screen.getByRole("radio", { name: /red/i });
    const blue = screen.getByRole("radio", { name: /blue/i });

    red.focus();
    await user.keyboard("{ArrowDown}");
    expect(onChange).toHaveBeenLastCalledWith("blue");
    expect(blue).toHaveFocus();
    expect(blue).toHaveAttribute("aria-checked", "true");
  });

  it("can suspend keyboard navigation without disabling items", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RadioGroup onChange={onChange} label="Colors" keyboardNavigation={false}>
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>,
    );

    const red = screen.getByRole("radio", { name: /red/i });
    const blue = screen.getByRole("radio", { name: /blue/i });
    expect(red).toHaveAttribute("tabindex", "0");
    expect(blue).toHaveAttribute("tabindex", "0");

    red.focus();
    await user.keyboard("{ArrowDown}");
    expect(onChange).not.toHaveBeenCalled();
    expect(red).toHaveFocus();

    await user.tab();
    expect(blue).toHaveFocus();

    await user.click(blue);
    expect(onChange).toHaveBeenCalledWith("blue");
    expect(screen.getByRole("radiogroup")).not.toHaveAttribute("aria-disabled");
  });

  it("commits the focused value with Enter during manual activation", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onEnter = vi.fn();
    render(
      <RadioGroup
        label="Colors"
        defaultValue="red"
        onChange={onChange}
        onEnter={onEnter}
        activationMode="manual"
      >
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>,
    );

    screen.getByRole("radio", { name: /red/i }).focus();
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onEnter).toHaveBeenCalledWith("blue", expect.objectContaining({ key: "Enter" }));
    expect(onChange).toHaveBeenCalledWith("blue");
    expect(screen.getByRole("radio", { name: /blue/i })).toHaveAttribute("aria-checked", "true");
  });

  it("can separate keyboard navigation from value changes during manual activation", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onNavigate = vi.fn();
    const onHighlight = vi.fn();
    render(
      <RadioGroup
        label="Colors"
        value="red"
        onChange={onChange}
        onNavigate={onNavigate}
        onHighlightChange={onHighlight}
        activationMode="manual"
      >
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>,
    );

    const red = screen.getByRole("radio", { name: /red/i });
    const blue = screen.getByRole("radio", { name: /blue/i });

    red.focus();
    await user.keyboard("{ArrowDown}");

    expect(blue).toHaveFocus();
    expect(red).toHaveAttribute("tabindex", "-1");
    expect(blue).toHaveAttribute("tabindex", "0");
    expect(red).toHaveAttribute("aria-checked", "true");
    expect(blue).toHaveAttribute("aria-checked", "false");
    expect(onHighlight).toHaveBeenCalledWith("blue");
    expect(onNavigate).toHaveBeenCalledWith("blue", "next");
    expect(onChange).not.toHaveBeenCalled();

    await user.keyboard(" ");
    expect(onChange).toHaveBeenCalledWith("blue");
  });

  it("focuses the highlighted item when autofocus is enabled", async () => {
    render(
      <RadioGroup label="Colors" value="red" highlighted="blue" activationMode="manual" autoFocus>
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>,
    );

    await waitFor(() => expect(screen.getByRole("radio", { name: /blue/i })).toHaveFocus());
    expect(screen.getByRole("radio", { name: /red/i })).toHaveAttribute("aria-checked", "true");
  });
});
