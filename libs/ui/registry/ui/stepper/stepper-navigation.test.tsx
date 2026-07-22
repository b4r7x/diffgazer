import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { requireElement } from "../../testing/assertions";
import { Stepper } from "./index";

function requireStepTrigger(container: HTMLElement, stepId: string) {
  return requireElement(
    container.querySelector<HTMLButtonElement>(`[data-step-id="${stepId}"]`),
    `step trigger ${stepId}`,
  );
}

describe("Stepper focus management", () => {
  it("places a single tab stop on the active step (roving tabIndex)", async () => {
    const user = userEvent.setup();
    render(
      <Stepper>
        <Stepper.Step stepId="s1" status="completed">
          <Stepper.Trigger>Step 1</Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="s2" status="active">
          <Stepper.Trigger>Step 2</Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="s3" status="pending">
          <Stepper.Trigger>Step 3</Stepper.Trigger>
        </Stepper.Step>
      </Stepper>,
    );

    const active = screen.getByRole("button", { name: /Step 2/ });
    const completed = screen.getByRole("button", { name: /Step 1/ });
    const pending = screen.getByRole("button", { name: /Step 3/ });

    expect(active).toHaveAttribute("tabIndex", "0");
    expect(completed).toHaveAttribute("tabIndex", "-1");
    expect(pending).toHaveAttribute("tabIndex", "-1");

    await user.tab();
    expect(active).toHaveFocus();
  });

  it("moves focus with arrow keys and Home/End, skipping disabled steps", async () => {
    const user = userEvent.setup();
    render(
      <Stepper>
        <Stepper.Step stepId="s1" status="completed">
          <Stepper.Trigger>Step 1</Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="s2" status="disabled">
          <Stepper.Trigger>Step 2</Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="s3" status="active">
          <Stepper.Trigger>Step 3</Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="s4" status="pending">
          <Stepper.Trigger>Step 4</Stepper.Trigger>
        </Stepper.Step>
      </Stepper>,
    );

    const s1 = screen.getByRole("button", { name: /Step 1/ });
    const s3 = screen.getByRole("button", { name: /Step 3/ });
    const s4 = screen.getByRole("button", { name: /Step 4/ });

    s1.focus();
    expect(s1).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(s3).toHaveFocus(); // Step 2 is disabled — skipped

    await user.keyboard("{End}");
    expect(s4).toHaveFocus();

    await user.keyboard("{Home}");
    expect(s1).toHaveFocus();
  });

  it("consumes arrow keys when the only focusable trigger is already focused", () => {
    render(
      <Stepper>
        <Stepper.Step stepId="s1" status="active">
          <Stepper.Trigger>Step 1</Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="s2" status="disabled">
          <Stepper.Trigger>Step 2</Stepper.Trigger>
        </Stepper.Step>
      </Stepper>,
    );

    const trigger = screen.getByRole("button", { name: /Step 1/ });
    trigger.focus();

    const event = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    });
    trigger.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(trigger).toHaveFocus();
  });

  it("arrow navigation skips a trigger disabled via the disabled prop", async () => {
    const user = userEvent.setup();
    render(
      <Stepper>
        <Stepper.Step stepId="s1" status="completed">
          <Stepper.Trigger>Step 1</Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="s2" status="active">
          <Stepper.Trigger disabled>Step 2</Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="s3" status="pending">
          <Stepper.Trigger>Step 3</Stepper.Trigger>
        </Stepper.Step>
      </Stepper>,
    );

    const s1 = screen.getByRole("button", { name: /Step 1/ });
    const s3 = screen.getByRole("button", { name: /Step 3/ });

    s1.focus();
    await user.keyboard("{ArrowDown}");

    expect(s3).toHaveFocus();
  });

  it("arrow navigation skips an aria-hidden active step's trigger", async () => {
    const user = userEvent.setup();
    render(
      <Stepper>
        <Stepper.Step stepId="s1" status="completed">
          <Stepper.Trigger>Step 1</Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="s2" status="active" aria-hidden="true">
          <Stepper.Trigger>Step 2</Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="s3" status="pending">
          <Stepper.Trigger>Step 3</Stepper.Trigger>
        </Stepper.Step>
      </Stepper>,
    );

    const s1 = screen.getByRole("button", { name: /Step 1/ });
    const s3 = screen.getByRole("button", { name: /Step 3/ });

    s1.focus();
    await user.keyboard("{ArrowDown}");
    expect(s3).toHaveFocus(); // Step 2 is aria-hidden — skipped

    await user.keyboard("{ArrowUp}");
    expect(s1).toHaveFocus();
  });

  it("arrow navigation skips a step hidden by its class", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <>
        <style>{`.css-hidden-step { display: none; }`}</style>
        <Stepper>
          <Stepper.Step stepId="s1" status="completed">
            <Stepper.Trigger>Step 1</Stepper.Trigger>
          </Stepper.Step>
          <Stepper.Step stepId="s2" status="active" className="css-hidden-step">
            <Stepper.Trigger>Step 2</Stepper.Trigger>
          </Stepper.Step>
          <Stepper.Step stepId="s3" status="pending">
            <Stepper.Trigger>Step 3</Stepper.Trigger>
          </Stepper.Step>
        </Stepper>
      </>,
    );

    const s1 = screen.getByRole("button", { name: /Step 1/ });
    const s3 = screen.getByRole("button", { name: /Step 3/ });
    const hiddenStep = container.querySelector<HTMLElement>('[data-step-id="s2"]');
    if (!hiddenStep) throw new Error("Expected class-hidden step trigger");

    await waitFor(() => {
      expect(hiddenStep).toHaveAttribute("tabIndex", "-1");
    });

    s1.focus();
    await user.keyboard("{ArrowDown}");
    expect(s3).toHaveFocus();
  });

  it("marks disabled steps with aria-disabled and excludes them from tab order", () => {
    render(
      <Stepper>
        <Stepper.Step stepId="s1" status="disabled">
          <Stepper.Trigger>Locked step</Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="s2" status="active">
          <Stepper.Trigger>Open step</Stepper.Trigger>
        </Stepper.Step>
      </Stepper>,
    );

    const disabled = screen.getByRole("button", { name: /Locked step/ });
    expect(disabled).toHaveAttribute("aria-disabled", "true");
    expect(disabled).toHaveAttribute("tabIndex", "-1");
  });

  it("tab target skips a prop-disabled step", async () => {
    const user = userEvent.setup();
    render(
      <Stepper>
        <Stepper.Step stepId="s1" status="completed">
          <Stepper.Trigger>Step 1</Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="s2" status="active">
          <Stepper.Trigger disabled>Step 2</Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="s3" status="pending">
          <Stepper.Trigger>Step 3</Stepper.Trigger>
        </Stepper.Step>
      </Stepper>,
    );

    const s1 = screen.getByRole("button", { name: /Step 1/ });
    const s2 = screen.getByRole("button", { name: /Step 2/ });
    const s3 = screen.getByRole("button", { name: /Step 3/ });

    expect(s1).toHaveAttribute("tabIndex", "0");
    expect(s2).toHaveAttribute("tabIndex", "-1");
    expect(s3).toHaveAttribute("tabIndex", "-1");

    await user.tab();
    expect(s1).toHaveFocus();
  });

  it("tab target skips a hidden active step", () => {
    const { container } = render(
      <Stepper>
        <Stepper.Step stepId="s1" status="active" hidden>
          <Stepper.Trigger>Step 1</Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="s2" status="pending">
          <Stepper.Trigger>Step 2</Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="s3" status="pending">
          <Stepper.Trigger>Step 3</Stepper.Trigger>
        </Stepper.Step>
      </Stepper>,
    );

    expect(requireStepTrigger(container, "s1")).toHaveAttribute("tabIndex", "-1");
    expect(requireStepTrigger(container, "s2")).toHaveAttribute("tabIndex", "0");
    expect(requireStepTrigger(container, "s3")).toHaveAttribute("tabIndex", "-1");
  });

  it("tab target skips an inert active step", () => {
    const { container } = render(
      <Stepper>
        <Stepper.Step stepId="s1" status="active" inert>
          <Stepper.Trigger>Step 1</Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="s2" status="pending">
          <Stepper.Trigger>Step 2</Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="s3" status="pending">
          <Stepper.Trigger>Step 3</Stepper.Trigger>
        </Stepper.Step>
      </Stepper>,
    );

    expect(requireStepTrigger(container, "s1")).toHaveAttribute("tabIndex", "-1");
    expect(requireStepTrigger(container, "s2")).toHaveAttribute("tabIndex", "0");
    expect(requireStepTrigger(container, "s3")).toHaveAttribute("tabIndex", "-1");
  });

  it("tab target skips an aria-hidden active step", () => {
    const { container } = render(
      <Stepper>
        <Stepper.Step stepId="s1" status="active" aria-hidden="true">
          <Stepper.Trigger>Step 1</Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="s2" status="pending">
          <Stepper.Trigger>Step 2</Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="s3" status="pending">
          <Stepper.Trigger>Step 3</Stepper.Trigger>
        </Stepper.Step>
      </Stepper>,
    );

    expect(requireStepTrigger(container, "s1")).toHaveAttribute("tabIndex", "-1");
    expect(requireStepTrigger(container, "s2")).toHaveAttribute("tabIndex", "0");
    expect(requireStepTrigger(container, "s3")).toHaveAttribute("tabIndex", "-1");
  });
});

function renderStepperInSameOriginIframe(ui: ReactElement) {
  const iframe = document.createElement("iframe");
  document.body.appendChild(iframe);
  const iframeDoc = iframe.contentDocument;
  if (!iframeDoc) {
    iframe.remove();
    throw new Error("iframe.contentDocument is null; cannot exercise cross-document stepper");
  }
  const container = iframeDoc.createElement("div");
  iframeDoc.body.appendChild(container);
  const view = render(ui, { container });
  return { iframe, iframeDoc, ...view };
}

describe("Stepper cross-document keyboard navigation", () => {
  it("moves focus with arrow keys inside the trigger ownerDocument", async () => {
    const { iframe, iframeDoc } = renderStepperInSameOriginIframe(
      <Stepper>
        <Stepper.Step stepId="s1" status="completed">
          <Stepper.Trigger>Step 1</Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="s2" status="active">
          <Stepper.Trigger>Step 2</Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="s3" status="pending">
          <Stepper.Trigger>Step 3</Stepper.Trigger>
        </Stepper.Step>
      </Stepper>,
    );

    const user = userEvent.setup({ document: iframeDoc });
    const s1 = within(iframeDoc.body).getByRole("button", { name: /Step 1/ });
    const s2 = within(iframeDoc.body).getByRole("button", { name: /Step 2/ });
    s1.focus();
    await user.keyboard("{ArrowDown}");
    expect(s2).toHaveFocus();

    iframe.remove();
  });
});
