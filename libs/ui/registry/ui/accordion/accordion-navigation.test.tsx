import { testNavigationBehavior } from "@diffgazer/keys/testing/navigation-behavior";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
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

  it("moves focus between triggers when the accordion is inside an open shadow root", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const shadowRoot = host.attachShadow({ mode: "open" });
    const mountPoint = document.createElement("div");
    shadowRoot.append(mountPoint);

    render(
      <Accordion>
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
      </Accordion>,
      { container: mountPoint },
    );

    const triggerOne = within(mountPoint).getByRole("button", { name: "Section One" });
    const triggerTwo = within(mountPoint).getByRole("button", { name: "Section Two" });

    triggerOne.focus();
    expect(shadowRoot.activeElement).toBe(triggerOne);

    act(() => {
      triggerOne.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, composed: true }),
      );
    });

    expect(shadowRoot.activeElement).toBe(triggerTwo);
    host.remove();
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
      { key: "{ArrowDown}{ArrowUp}", expectedActiveIndex: 0, label: "ArrowDown then ArrowUp" },
      { key: "{End}", expectedActiveIndex: 2, label: "End jumps to last" },
      { key: "{Home}", expectedActiveIndex: 0, label: "Home stays at first" },
    ],
  });
});
