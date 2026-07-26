import { render, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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

describe("Accordion prefers-reduced-motion", () => {
  // jsdom does not evaluate @media, so inject motion-reduce:transition-none
  // unconditionally to simulate prefers-reduced-motion.
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

describe("Accordion trigger touch target", () => {
  // The trigger sits in a stack of rows: the padding grows the target, the vertical pull-back keeps
  // the row rhythm unchanged, and pointer-coarse trades that pull-back for a real 44px minimum. The
  // pull-back is spelled longhand so the source variant's mb-0 can override one side without
  // depending on shorthand/longhand rule order. jsdom computes no layout, so the recipe is asserted
  // through its class tokens.
  it("applies the touch hit-area recipe to the default trigger", () => {
    renderAccordion();
    const trigger = screen.getByRole("button", { name: "Section One" });
    expect(trigger).toHaveClass(
      "py-2",
      "-mt-2",
      "-mb-2",
      "pointer-coarse:mt-0",
      "pointer-coarse:mb-0",
      "pointer-coarse:min-h-11",
    );
  });

  it("keeps the recipe on the source variant and drops its compensating margin", () => {
    render(
      <Accordion>
        <Accordion.Item value="src">
          <Accordion.Header>
            <Accordion.Trigger variant="source">Show source</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>Source</Accordion.Content>
        </Accordion.Item>
      </Accordion>,
    );
    const trigger = screen.getByRole("button", { name: "Show source" });
    expect(trigger).toHaveClass("py-2", "-mt-2", "pointer-coarse:min-h-11", "mb-0");
    expect(trigger).not.toHaveClass("-mb-2");
  });
});
