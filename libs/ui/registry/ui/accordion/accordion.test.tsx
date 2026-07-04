import { testNavigationBehavior } from "@diffgazer/keys/testing/navigation-behavior";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { Accordion, type AccordionMultipleProps, type AccordionSingleProps } from "./index";

type AccordionRenderProps =
  | Partial<Omit<AccordionSingleProps, "children">>
  | ({ type: "multiple" } & Partial<Omit<AccordionMultipleProps, "children" | "type">>);

function renderAccordion(props: AccordionRenderProps = {}) {
  return render(
    <Accordion {...props}>
      <Accordion.Item value="one">
        <Accordion.Header>
          <Accordion.Trigger>Section One</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content>Content One</Accordion.Content>
      </Accordion.Item>
      <Accordion.Item value="two">
        <Accordion.Header>
          <Accordion.Trigger>Section Two</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content>Content Two</Accordion.Content>
      </Accordion.Item>
      <Accordion.Item value="three">
        <Accordion.Header>
          <Accordion.Trigger>Section Three</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content>Content Three</Accordion.Content>
      </Accordion.Item>
    </Accordion>,
  );
}

describe("Accordion", () => {
  it("opens an item when its trigger is clicked", async () => {
    const user = userEvent.setup();
    renderAccordion();
    const trigger = screen.getByRole("button", { name: "Section One" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("closes an open item when clicked again (collapsible by default)", async () => {
    const user = userEvent.setup();
    renderAccordion({ defaultValue: "one" });
    const trigger = screen.getByRole("button", { name: "Section One" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("single mode closes previous item when another is opened", async () => {
    const user = userEvent.setup();
    renderAccordion({ defaultValue: "one" });
    const triggerOne = screen.getByRole("button", { name: "Section One" });
    const triggerTwo = screen.getByRole("button", { name: "Section Two" });
    expect(triggerOne).toHaveAttribute("aria-expanded", "true");
    await user.click(triggerTwo);
    expect(triggerOne).toHaveAttribute("aria-expanded", "false");
    expect(triggerTwo).toHaveAttribute("aria-expanded", "true");
  });

  it("single mode with collapsible=false prevents closing the open item", async () => {
    const user = userEvent.setup();
    renderAccordion({ defaultValue: "one", collapsible: false });
    const trigger = screen.getByRole("button", { name: "Section One" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).not.toBeDisabled();
    expect(trigger).toHaveAttribute("aria-disabled", "true");
    trigger.focus();
    expect(trigger).toHaveFocus();
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("multiple mode allows several items open and toggles independently", async () => {
    const user = userEvent.setup();
    renderAccordion({ type: "multiple" });
    const triggerOne = screen.getByRole("button", { name: "Section One" });
    const triggerTwo = screen.getByRole("button", { name: "Section Two" });
    await user.click(triggerOne);
    await user.click(triggerTwo);
    expect(triggerOne).toHaveAttribute("aria-expanded", "true");
    expect(triggerTwo).toHaveAttribute("aria-expanded", "true");
    await user.click(triggerOne);
    expect(triggerOne).toHaveAttribute("aria-expanded", "false");
    expect(triggerTwo).toHaveAttribute("aria-expanded", "true");
  });

  it("does not toggle a disabled item", async () => {
    const user = userEvent.setup();
    render(
      <Accordion>
        <Accordion.Item value="one" disabled>
          <Accordion.Header>
            <Accordion.Trigger>Disabled</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>Hidden</Accordion.Content>
        </Accordion.Item>
      </Accordion>,
    );
    const trigger = screen.getByRole("button", { name: "Disabled" });
    expect(trigger).toBeDisabled();
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("works uncontrolled with defaultValue (multiple)", async () => {
    renderAccordion({ type: "multiple", defaultValue: ["one", "three"] });
    expect(screen.getByRole("button", { name: "Section One" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("button", { name: "Section Two" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByRole("button", { name: "Section Three" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("keeps explicit value undefined controlled instead of adopting internal state", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderAccordion({ value: undefined, onChange });
    const sectionOne = screen.getByRole("button", { name: "Section One" });
    const sectionTwo = screen.getByRole("button", { name: "Section Two" });
    expect(sectionOne).toHaveAttribute("aria-expanded", "false");
    expect(sectionTwo).toHaveAttribute("aria-expanded", "false");

    await user.click(sectionTwo);
    expect(onChange).toHaveBeenCalledWith("two");
    expect(sectionOne).toHaveAttribute("aria-expanded", "false");
    expect(sectionTwo).toHaveAttribute("aria-expanded", "false");
  });

  it("controlled single mode calls onChange with new value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderAccordion({ value: "one", onChange });
    await user.click(screen.getByRole("button", { name: "Section Two" }));
    expect(onChange).toHaveBeenCalledWith("two");
  });

  it("controlled single mode calls onChange with null when collapsing", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderAccordion({ value: "one", onChange });
    await user.click(screen.getByRole("button", { name: "Section One" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("controlled multiple mode calls onChange with updated array", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderAccordion({ type: "multiple", value: ["one"], onChange });
    await user.click(screen.getByRole("button", { name: "Section Two" }));
    expect(onChange).toHaveBeenCalledWith(["one", "two"]);
  });

  it("forwards trigger props and honors preventDefault in consumer click handlers", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLButtonElement>();
    const onClick = vi.fn((event) => event.preventDefault());

    render(
      <Accordion>
        <Accordion.Item value="one">
          <Accordion.Header>
            <Accordion.Trigger ref={ref} onClick={onClick}>
              Section One
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>Content One</Accordion.Content>
        </Accordion.Item>
      </Accordion>,
    );

    const trigger = screen.getByRole("button", { name: "Section One" });
    expect(ref.current).toBe(trigger);
    await user.click(trigger);
    expect(onClick).toHaveBeenCalledOnce();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("forwards aria-label to the root group", () => {
    renderAccordion({ "aria-label": "FAQ" });
    expect(screen.getByRole("group", { name: "FAQ" })).toBeInTheDocument();
  });

  it("forwards aria-labelledby to the root group", () => {
    render(
      <>
        <h2 id="faq-heading">Questions</h2>
        <Accordion aria-labelledby="faq-heading">
          <Accordion.Item value="one">
            <Accordion.Header>
              <Accordion.Trigger>Section One</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content>Content One</Accordion.Content>
          </Accordion.Item>
        </Accordion>
      </>,
    );
    expect(screen.getByRole("group", { name: "Questions" })).toBeInTheDocument();
  });

  it("has no a11y violations", async () => {
    const { container } = renderAccordion();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("does not expose panel regions by default", () => {
    renderAccordion({ defaultValue: "one" });
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("exposes an opt-in region only while the panel is expanded", () => {
    render(
      <Accordion defaultValue="one">
        <Accordion.Item value="one">
          <Accordion.Header>
            <Accordion.Trigger>Section One</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content region>Content One</Accordion.Content>
        </Accordion.Item>
        <Accordion.Item value="two">
          <Accordion.Header>
            <Accordion.Trigger>Section Two</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content region>Content Two</Accordion.Content>
        </Accordion.Item>
      </Accordion>,
    );

    expect(screen.getByRole("region", { name: "Section One" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Section Two" })).not.toBeInTheDocument();
  });

  it("uses native button semantics without a redundant role attribute", () => {
    renderAccordion();
    expect(screen.getByRole("button", { name: "Section One" })).not.toHaveAttribute("role");
  });

  it("ArrowDown/ArrowUp moves focus between triggers", async () => {
    const user = userEvent.setup();
    renderAccordion();
    const triggerOne = screen.getByRole("button", { name: "Section One" });
    const triggerTwo = screen.getByRole("button", { name: "Section Two" });
    triggerOne.focus();
    await user.keyboard("{ArrowDown}");
    expect(triggerTwo).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(triggerOne).toHaveFocus();
  });

  it("does not handle arrow navigation when focus is inside panel content", async () => {
    const user = userEvent.setup();
    render(
      <Accordion defaultValue="one">
        <Accordion.Item value="one">
          <Accordion.Header>
            <Accordion.Trigger>Section One</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>
            <input aria-label="Panel field" />
          </Accordion.Content>
        </Accordion.Item>
        <Accordion.Item value="two">
          <Accordion.Header>
            <Accordion.Trigger>Section Two</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>Content Two</Accordion.Content>
        </Accordion.Item>
      </Accordion>,
    );
    const input = screen.getByRole("textbox", { name: "Panel field" });
    input.focus();

    await user.keyboard("{ArrowDown}");

    expect(input).toHaveFocus();
    expect(screen.getByRole("button", { name: "Section Two" })).not.toHaveFocus();
  });

  it("ArrowDown/ArrowUp wraps around at boundaries", async () => {
    const user = userEvent.setup();
    renderAccordion();
    const triggerOne = screen.getByRole("button", { name: "Section One" });
    const triggerThree = screen.getByRole("button", { name: "Section Three" });
    triggerOne.focus();
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowDown}");
    expect(triggerThree).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(triggerOne).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(triggerThree).toHaveFocus();
  });

  it("does not navigate outer triggers when arrow is pressed inside a nested accordion", async () => {
    const user = userEvent.setup();
    render(
      <Accordion defaultValue="one">
        <Accordion.Item value="one">
          <Accordion.Header>
            <Accordion.Trigger>Outer One</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>
            <Accordion>
              <Accordion.Item value="inner-a">
                <Accordion.Header>
                  <Accordion.Trigger>Inner A</Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content>Inner A content</Accordion.Content>
              </Accordion.Item>
              <Accordion.Item value="inner-b">
                <Accordion.Header>
                  <Accordion.Trigger>Inner B</Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content>Inner B content</Accordion.Content>
              </Accordion.Item>
            </Accordion>
          </Accordion.Content>
        </Accordion.Item>
        <Accordion.Item value="two">
          <Accordion.Header>
            <Accordion.Trigger>Outer Two</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>Outer Two content</Accordion.Content>
        </Accordion.Item>
      </Accordion>,
    );

    const innerA = screen.getByRole("button", { name: "Inner A" });
    const innerB = screen.getByRole("button", { name: "Inner B" });
    const outerTwo = screen.getByRole("button", { name: "Outer Two" });

    innerA.focus();
    await user.keyboard("{ArrowDown}");
    expect(innerB).toHaveFocus();
    expect(outerTwo).not.toHaveFocus();
  });

  it("End on outer accordion focuses the outer last trigger, not a nested trigger", async () => {
    const user = userEvent.setup();
    render(
      <Accordion defaultValue="one">
        <Accordion.Item value="one">
          <Accordion.Header>
            <Accordion.Trigger>Outer One</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>
            <Accordion>
              <Accordion.Item value="inner-a">
                <Accordion.Header>
                  <Accordion.Trigger>Inner A</Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content>Inner A content</Accordion.Content>
              </Accordion.Item>
              <Accordion.Item value="inner-b">
                <Accordion.Header>
                  <Accordion.Trigger>Inner B</Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content>Inner B content</Accordion.Content>
              </Accordion.Item>
            </Accordion>
          </Accordion.Content>
        </Accordion.Item>
        <Accordion.Item value="two">
          <Accordion.Header>
            <Accordion.Trigger>Outer Two</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>Outer Two content</Accordion.Content>
        </Accordion.Item>
      </Accordion>,
    );

    const outerOne = screen.getByRole("button", { name: "Outer One" });
    const outerTwo = screen.getByRole("button", { name: "Outer Two" });
    const innerB = screen.getByRole("button", { name: "Inner B" });

    outerOne.focus();
    await user.keyboard("{End}");

    expect(outerTwo).toHaveFocus();
    expect(innerB).not.toHaveFocus();
  });

  it("ArrowDown on outer trigger skips nested triggers and goes to next outer trigger", async () => {
    const user = userEvent.setup();
    render(
      <Accordion defaultValue="one">
        <Accordion.Item value="one">
          <Accordion.Header>
            <Accordion.Trigger>Outer One</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>
            <Accordion>
              <Accordion.Item value="inner-a">
                <Accordion.Header>
                  <Accordion.Trigger>Inner A</Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content>Inner A content</Accordion.Content>
              </Accordion.Item>
              <Accordion.Item value="inner-b">
                <Accordion.Header>
                  <Accordion.Trigger>Inner B</Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content>Inner B content</Accordion.Content>
              </Accordion.Item>
            </Accordion>
          </Accordion.Content>
        </Accordion.Item>
        <Accordion.Item value="two">
          <Accordion.Header>
            <Accordion.Trigger>Outer Two</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>Outer Two content</Accordion.Content>
        </Accordion.Item>
      </Accordion>,
    );

    const outerOne = screen.getByRole("button", { name: "Outer One" });
    const outerTwo = screen.getByRole("button", { name: "Outer Two" });

    outerOne.focus();
    await user.keyboard("{ArrowDown}");

    expect(outerTwo).toHaveFocus();
  });

  it("keeps aria-disabled non-collapsible triggers in roving order and skips disabled items", async () => {
    const user = userEvent.setup();
    render(
      <Accordion defaultValue="one" collapsible={false}>
        <Accordion.Item value="one">
          <Accordion.Header>
            <Accordion.Trigger>Section One</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>Content One</Accordion.Content>
        </Accordion.Item>
        <Accordion.Item value="two" disabled>
          <Accordion.Header>
            <Accordion.Trigger>Section Two</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>Content Two</Accordion.Content>
        </Accordion.Item>
        <Accordion.Item value="three">
          <Accordion.Header>
            <Accordion.Trigger>Section Three</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>Content Three</Accordion.Content>
        </Accordion.Item>
      </Accordion>,
    );
    const triggerOne = screen.getByRole("button", { name: "Section One" });
    const triggerThree = screen.getByRole("button", { name: "Section Three" });
    expect(triggerOne).toHaveAttribute("aria-disabled", "true");

    triggerThree.focus();
    await user.keyboard("{ArrowDown}");
    expect(triggerOne).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(triggerThree).toHaveFocus();
  });
});

describe("Accordion heading semantics", () => {
  it("wraps a bare trigger in a default h3 heading", () => {
    render(
      <Accordion>
        <Accordion.Item value="one">
          <Accordion.Trigger>Section One</Accordion.Trigger>
          <Accordion.Content>Content One</Accordion.Content>
        </Accordion.Item>
      </Accordion>,
    );

    const heading = screen.getByRole("heading", { level: 3, name: "Section One" });
    expect(heading.querySelector("button")).toBe(
      screen.getByRole("button", { name: "Section One" }),
    );
  });

  it("honors a custom headingLevel on a bare trigger", () => {
    render(
      <Accordion>
        <Accordion.Item value="one">
          <Accordion.Trigger headingLevel="h2">Section One</Accordion.Trigger>
          <Accordion.Content>Content One</Accordion.Content>
        </Accordion.Item>
      </Accordion>,
    );

    expect(screen.getByRole("heading", { level: 2, name: "Section One" })).toBeInTheDocument();
  });

  it("yields exactly one heading when composed inside AccordionHeader", () => {
    render(
      <Accordion>
        <Accordion.Item value="one">
          <Accordion.Header as="h4">
            <Accordion.Trigger>Section One</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>Content One</Accordion.Content>
        </Accordion.Item>
      </Accordion>,
    );

    const headings = screen.getAllByRole("heading", { name: "Section One" });
    expect(headings).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 4, name: "Section One" }).tagName).toBe("H4");
  });
});

describe("Accordion inert on collapsed content", () => {
  it("collapsed content is inert, expanded content is not", async () => {
    render(
      <Accordion type="single" defaultValue="one">
        <Accordion.Item value="one">
          <Accordion.Header>
            <Accordion.Trigger>Section One</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>
            <button type="button">Button One</button>
          </Accordion.Content>
        </Accordion.Item>
        <Accordion.Item value="two">
          <Accordion.Header>
            <Accordion.Trigger>Section Two</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>
            <button type="button">Button Two</button>
          </Accordion.Content>
        </Accordion.Item>
      </Accordion>,
    );

    function inertWrapperFor(triggerName: string): HTMLElement {
      const trigger = screen.getByRole("button", { name: triggerName });
      const contentId = trigger.getAttribute("aria-controls");
      if (!contentId)
        throw new Error("Accordion trigger must reference a content id via aria-controls");
      const wrapper = document.getElementById(contentId)?.parentElement;
      if (!wrapper)
        throw new Error("Expected accordion content to have a transition wrapper parent");
      return wrapper;
    }

    expect(inertWrapperFor("Section One")).not.toHaveAttribute("inert");
    expect(inertWrapperFor("Section Two")).toHaveAttribute("inert");
  });
});

describe("Accordion keyboard navigation", () => {
  testNavigationBehavior({
    setup: () => {
      const rendered = renderAccordion();
      screen.getByRole("button", { name: "Section One" }).focus();
      return rendered;
    },
    items: ["Section One", "Section Two", "Section Three"],
    initialActive: 0,
    cases: [
      { key: "{ArrowDown}", expectedActiveIndex: 1, label: "ArrowDown" },
      { key: "{ArrowDown}{ArrowDown}", expectedActiveIndex: 2, label: "ArrowDown twice" },
      {
        key: "{ArrowDown}{ArrowDown}{ArrowDown}",
        expectedActiveIndex: 0,
        label: "ArrowDown wraps",
      },
      { key: "{ArrowUp}", expectedActiveIndex: 2, label: "ArrowUp wraps to end" },
      { key: "{End}", expectedActiveIndex: 2, label: "End jumps to last" },
      { key: "{Home}", expectedActiveIndex: 0, label: "Home stays at first" },
    ],
  });
});

describe("Accordion prefers-reduced-motion", () => {
  // The grid-template-rows transition that animates expand/collapse must be
  // suppressed under prefers-reduced-motion. Tailwind v4 compiles
  // `motion-reduce:transition-none` to a @media (prefers-reduced-motion: reduce)
  // rule that sets transition-property: none. jsdom does not evaluate @media
  // in stylesheets, so the underlying declaration is injected unconditionally
  // at the top level to simulate matchMedia returning true; getComputedStyle
  // then reports the suppressed transition.
  let styleElement: HTMLStyleElement | null = null;

  beforeAll(() => {
    styleElement = document.createElement("style");
    styleElement.dataset.testSource = "tailwind#motion-reduce:transition-none";
    styleElement.textContent = `.motion-reduce\\:transition-none { transition-property: none; }`;
    document.head.appendChild(styleElement);
  });

  afterAll(() => {
    styleElement?.remove();
    styleElement = null;
  });

  it("suppresses the grid-row transition on the animated wrapper", () => {
    renderAccordion();
    const trigger = screen.getByRole("button", { name: "Section One" });
    const contentId = trigger.getAttribute("aria-controls");
    if (!contentId)
      throw new Error("Accordion trigger must reference a content id via aria-controls");
    const innerContent = document.getElementById(contentId);
    const transitionWrapper = innerContent?.parentElement;
    if (!transitionWrapper)
      throw new Error("Expected accordion content to have a transition wrapper parent");
    expect(getComputedStyle(transitionWrapper).transitionProperty).toBe("none");
  });
});
