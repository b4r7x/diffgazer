import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { requireElement, requireValue } from "../../testing/assertions";
import { Stepper, type StepperProps } from "./index";

function renderStepper(props: Partial<StepperProps> = {}) {
  return render(
    <Stepper {...props}>
      <Stepper.Step stepId="s1" status="completed">
        <Stepper.Trigger>Step 1</Stepper.Trigger>
        <Stepper.Content>Content 1</Stepper.Content>
      </Stepper.Step>
      <Stepper.Step stepId="s2" status="active">
        <Stepper.Trigger>Step 2</Stepper.Trigger>
        <Stepper.Content>Content 2</Stepper.Content>
      </Stepper.Step>
      <Stepper.Step stepId="s3" status="pending">
        <Stepper.Trigger>Step 3</Stepper.Trigger>
        <Stepper.Content>Content 3</Stepper.Content>
      </Stepper.Step>
    </Stepper>,
  );
}

describe("Stepper", () => {
  it("expands step content when trigger is clicked", async () => {
    const user = userEvent.setup();
    renderStepper();
    const trigger = screen.getByRole("button", { name: /Step 1/ });
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const region = screen.getByRole("region", { name: /Step 1/ });
    expect(region).not.toHaveAttribute("aria-hidden");
  });

  it("collapses an expanded step when trigger is clicked again", async () => {
    const user = userEvent.setup();
    renderStepper({ defaultExpandedIds: ["s1"] });
    const trigger = screen.getByRole("button", { name: /Step 1/ });
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("expands steps matching defaultExpandedIds initially", () => {
    renderStepper({ defaultExpandedIds: ["s1", "s2"] });
    expect(screen.getByRole("button", { name: /Step 1/ })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: /Step 2/ })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: /Step 3/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("fires onExpandedChange in controlled mode", async () => {
    const user = userEvent.setup();
    const onExpandedChange = vi.fn();
    const { rerender } = render(
      <Stepper expandedIds={[]} onExpandedChange={onExpandedChange}>
        <Stepper.Step stepId="s1" status="active">
          <Stepper.Trigger>Step 1</Stepper.Trigger>
          <Stepper.Content>Content 1</Stepper.Content>
        </Stepper.Step>
      </Stepper>,
    );
    await user.click(screen.getByRole("button", { name: /Step 1/ }));
    expect(onExpandedChange).toHaveBeenCalledWith(["s1"]);
    expect(screen.getByRole("button", { name: /Step 1/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );

    rerender(
      <Stepper expandedIds={["s1"]} onExpandedChange={onExpandedChange}>
        <Stepper.Step stepId="s1" status="active">
          <Stepper.Trigger>Step 1</Stepper.Trigger>
          <Stepper.Content>Content 1</Stepper.Content>
        </Stepper.Step>
      </Stepper>,
    );
    expect(screen.getByRole("button", { name: /Step 1/ })).toHaveAttribute("aria-expanded", "true");
  });

  it("calls consumer trigger onClick before expanding", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Stepper>
        <Stepper.Step stepId="s1" status="active">
          <Stepper.Trigger onClick={onClick}>Step 1</Stepper.Trigger>
          <Stepper.Content>Content 1</Stepper.Content>
        </Stepper.Step>
      </Stepper>,
    );
    const trigger = screen.getByRole("button", { name: /Step 1/ });

    await user.click(trigger);

    expect(onClick).toHaveBeenCalled();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("does not expand when trigger click is prevented", async () => {
    const user = userEvent.setup();
    render(
      <Stepper>
        <Stepper.Step stepId="s1" status="active">
          <Stepper.Trigger onClick={(event) => event.preventDefault()}>Step 1</Stepper.Trigger>
          <Stepper.Content>Content 1</Stepper.Content>
        </Stepper.Step>
      </Stepper>,
    );
    const trigger = screen.getByRole("button", { name: /Step 1/ });

    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("only emits aria-controls when the referenced content exists", () => {
    render(
      <Stepper>
        <Stepper.Step stepId="s1" status="active">
          <Stepper.Trigger>With content</Stepper.Trigger>
          <Stepper.Content>Content 1</Stepper.Content>
        </Stepper.Step>
        <Stepper.Step stepId="s2" status="pending">
          <Stepper.Trigger>No content</Stepper.Trigger>
        </Stepper.Step>
      </Stepper>,
    );

    const withContent = screen.getByRole("button", { name: /With content/ });
    const withoutContent = screen.getByRole("button", { name: /No content/ });
    const contentId = requireValue(
      withContent.getAttribute("aria-controls"),
      "step content aria-controls",
    );

    expect(requireElement(document.getElementById(contentId), "step content")).toBeInTheDocument();
    expect(withoutContent).not.toHaveAttribute("aria-controls");
    expect(withoutContent).not.toHaveAttribute("aria-expanded");
  });

  it("does not toggle steps that have no content", async () => {
    const user = userEvent.setup();
    const onExpandedChange = vi.fn();
    render(
      <Stepper onExpandedChange={onExpandedChange}>
        <Stepper.Step stepId="s1" status="active">
          <Stepper.Trigger>No content</Stepper.Trigger>
        </Stepper.Step>
      </Stepper>,
    );

    const trigger = screen.getByRole("button", { name: /No content/ });
    await user.click(trigger);

    expect(onExpandedChange).not.toHaveBeenCalled();
    expect(trigger).not.toHaveAttribute("aria-expanded");
  });

  it("has no a11y violations", async () => {
    const { container } = renderStepper({ defaultExpandedIds: ["s1"] });
    expect(await axe(container)).toHaveNoViolations();
  });

  it("uses provided statusLabels for substep fallback text", () => {
    render(
      <Stepper defaultExpandedIds={["s1"]}>
        <Stepper.Step stepId="s1" status="active">
          <Stepper.Trigger>Step 1</Stepper.Trigger>
          <Stepper.Content>
            <Stepper.Substep
              tag="A"
              label="Substep A"
              status="active"
              statusLabels={{ active: "analyzing..." }}
            />
            <Stepper.Substep tag="B" label="Substep B" status="completed" detail="custom detail" />
          </Stepper.Content>
        </Stepper.Step>
      </Stepper>,
    );
    expect(screen.getByText("analyzing...")).toBeInTheDocument();
    expect(screen.getByText("custom detail")).toBeInTheDocument();
  });

  it("exposes the full substep status text via title so truncation never hides it", () => {
    const detail = "65% — Waiting for model response — 30s";
    render(
      <Stepper defaultExpandedIds={["s1"]}>
        <Stepper.Step stepId="s1" status="active">
          <Stepper.Trigger>Step 1</Stepper.Trigger>
          <Stepper.Content>
            <Stepper.Substep tag="A" label="Substep A" status="active" detail={detail} />
            <Stepper.Substep
              tag="B"
              label="Substep B"
              status="active"
              statusLabels={{ active: "analyzing..." }}
            />
          </Stepper.Content>
        </Stepper.Step>
      </Stepper>,
    );
    expect(screen.getByText(detail)).toHaveAttribute("title", detail);
    expect(screen.getByText("analyzing...")).toHaveAttribute("title", "analyzing...");
  });
});
