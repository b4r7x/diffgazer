import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
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

  it("single mode with collapsible=false may start empty and prevents closing a selected item", async () => {
    const user = userEvent.setup();
    renderAccordion({ collapsible: false });
    const trigger = screen.getByRole("button", { name: "Section One" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).not.toBeDisabled();
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
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

  it("keeps explicit single value undefined controlled instead of adopting internal state", async () => {
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

  it("normalizes explicit multiple value undefined without losing controlledness", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderAccordion({ type: "multiple", value: undefined, onChange });
    const sectionTwo = screen.getByRole("button", { name: "Section Two" });

    expect(sectionTwo).toHaveAttribute("aria-expanded", "false");
    await user.click(sectionTwo);

    expect(onChange).toHaveBeenCalledWith(["two"]);
    expect(sectionTwo).toHaveAttribute("aria-expanded", "false");
  });

  it("controlled single mode calls onChange with new value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderAccordion({ value: "one", onChange });
    await user.click(screen.getByRole("button", { name: "Section Two" }));
    expect(onChange).toHaveBeenCalledWith("two");
  });

  it("controlled single mode calls onChange with undefined when collapsing", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderAccordion({ value: "one", onChange });
    await user.click(screen.getByRole("button", { name: "Section One" }));
    expect(onChange).toHaveBeenCalledWith(undefined);
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
});
