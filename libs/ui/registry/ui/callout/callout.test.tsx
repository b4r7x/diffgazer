import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Fragment } from "react";
import { describe, expect, it } from "vitest";
import { axe } from "../../../testing/axe";
import { Callout } from "./index";

function getGrid(container: HTMLElement): HTMLElement {
  const grid = container.querySelector("[data-frame] > [data-has-icon]") as HTMLElement;
  expect(grid).not.toBeNull();
  return grid;
}

describe("Callout structure", () => {
  it("renders the inline frame by default", () => {
    const { container } = render(
      <Callout>
        <Callout.Content>Hello</Callout.Content>
      </Callout>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute("data-frame", "inline");
  });

  it("rail frame is selected via the data-frame attribute", () => {
    const { container } = render(
      <Callout frame="rail">
        <Callout.Content>Rail</Callout.Content>
      </Callout>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute("data-frame", "rail");
  });

  it("bar frame renders a tone marker bar matching Dialog marker='bar'", () => {
    const { container } = render(
      <Callout frame="bar" tone="warning">
        <Callout.Title>Bar</Callout.Title>
        <Callout.Content>Body</Callout.Content>
      </Callout>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute("data-frame", "bar");
    const bar = root.querySelector('[data-slot="callout-bar"]') as HTMLElement;
    expect(bar).not.toBeNull();
    expect(bar).toHaveAttribute("aria-hidden", "true");
  });

  it("collapses the icon column when no Callout.Icon child is present", () => {
    const { container } = render(
      <Callout>
        <Callout.Title>Title only</Callout.Title>
      </Callout>,
    );
    const grid = getGrid(container);
    expect(grid).toHaveAttribute("data-has-icon", "false");
  });

  it("reserves the icon column when Callout.Icon child is present", () => {
    const { container } = render(
      <Callout>
        <Callout.Icon />
        <Callout.Title>Title</Callout.Title>
      </Callout>,
    );
    const grid = getGrid(container);
    expect(grid).toHaveAttribute("data-has-icon", "true");
  });

  it("detects a conditionally rendered icon inside a Fragment", () => {
    function ConditionalCallout({ showIcon }: { showIcon: boolean }) {
      return (
        <Callout>
          <Fragment key="conditional-icon">
            {showIcon ? <Callout.Icon /> : null}
            <Callout.Title>Conditional</Callout.Title>
          </Fragment>
        </Callout>
      );
    }

    const { container, rerender } = render(<ConditionalCallout showIcon={false} />);
    expect(getGrid(container)).toHaveAttribute("data-has-icon", "false");

    rerender(<ConditionalCallout showIcon />);
    expect(getGrid(container)).toHaveAttribute("data-has-icon", "true");
  });

  it("assigns each part its grid cell via data-slot (layout driven by callout.css)", () => {
    render(
      <Callout>
        <Callout.Icon />
        <Callout.Title>Heading</Callout.Title>
        <Callout.Content>Body</Callout.Content>
        <Callout.Dismiss />
      </Callout>,
    );
    expect(screen.getByText("Heading")).toHaveAttribute("data-slot", "callout-title");
    expect(screen.getByText("Body")).toHaveAttribute("data-slot", "callout-content");
    expect(screen.getByRole("button", { name: "Dismiss" })).toHaveAttribute(
      "data-slot",
      "callout-dismiss",
    );
  });
});

describe("Callout live-region semantics", () => {
  it("renders no role when live is not set", () => {
    render(
      <Callout tone="error">
        <Callout.Content>Silent error</Callout.Content>
      </Callout>,
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("applies role=alert for tone='error' when live", () => {
    render(
      <Callout tone="error" live>
        <Callout.Content>Loud error</Callout.Content>
      </Callout>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("applies role=status for tone='info' when live", () => {
    render(
      <Callout tone="info" live>
        <Callout.Content>FYI</Callout.Content>
      </Callout>,
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it.each([
    "warning",
    "success",
  ] as const)("applies role=status for tone='%s' when live", (tone) => {
    render(
      <Callout tone={tone} live>
        <Callout.Content>announce</Callout.Content>
      </Callout>,
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});

describe("Callout dismiss", () => {
  it("dismiss button hides the callout", async () => {
    const user = userEvent.setup();
    render(
      <Callout>
        <Callout.Title>Alert</Callout.Title>
        <Callout.Dismiss />
      </Callout>,
    );
    expect(screen.getByText("Alert")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("Alert")).not.toBeInTheDocument();
  });

  it("dismiss button has aria-label='Dismiss' and lands in the dismiss grid cell", () => {
    render(
      <Callout>
        <Callout.Title>Title</Callout.Title>
        <Callout.Dismiss />
      </Callout>,
    );
    const dismiss = screen.getByRole("button", { name: "Dismiss" });
    expect(dismiss).toHaveAttribute("aria-label", "Dismiss");
    expect(dismiss).toHaveAttribute("data-slot", "callout-dismiss");
  });

  it("uses visible text children as the dismiss accessible name (no clobbering aria-label)", () => {
    render(
      <Callout>
        <Callout.Title>Title</Callout.Title>
        <Callout.Dismiss>Dismiss notice</Callout.Dismiss>
      </Callout>,
    );
    const dismiss = screen.getByRole("button", { name: "Dismiss notice" });
    expect(dismiss).not.toHaveAttribute("aria-label");
  });

  it("uses a visible bigint child as the dismiss accessible name", async () => {
    const { container } = render(
      <Callout>
        <Callout.Title>Title</Callout.Title>
        <Callout.Dismiss>{1n}</Callout.Dismiss>
      </Callout>,
    );

    const dismiss = screen.getByRole("button", { name: "1" });
    expect(dismiss).not.toHaveAttribute("aria-label");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("retains the default name for a decorative icon child", () => {
    render(
      <Callout>
        <Callout.Title>Title</Callout.Title>
        <Callout.Dismiss>
          <svg aria-hidden="true" viewBox="0 0 10 10" />
        </Callout.Dismiss>
      </Callout>,
    );

    expect(screen.getByRole("button", { name: "Dismiss" })).toHaveAttribute(
      "aria-label",
      "Dismiss",
    );
  });

  it("retains the default name when nested text is hidden", async () => {
    const { container } = render(
      <Callout>
        <Callout.Title>Title</Callout.Title>
        <Callout.Dismiss>
          <span hidden>Close</span>
        </Callout.Dismiss>
      </Callout>,
    );

    expect(screen.getByRole("button", { name: "Dismiss" })).toHaveAttribute(
      "aria-label",
      "Dismiss",
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("uses an explicit aria-labelledby name before child fallback detection", async () => {
    const { container } = render(
      <>
        <span id="callout-dismiss-label">Close maintenance notice</span>
        <Callout>
          <Callout.Title>Title</Callout.Title>
          <Callout.Dismiss aria-labelledby="callout-dismiss-label">
            <svg aria-hidden="true" viewBox="0 0 10 10" />
          </Callout.Dismiss>
        </Callout>
      </>,
    );

    const dismiss = screen.getByRole("button", { name: "Close maintenance notice" });
    expect(dismiss).toHaveAttribute("aria-labelledby", "callout-dismiss-label");
    expect(dismiss).not.toHaveAttribute("aria-label");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("prefers an explicit name for a decorative icon child", () => {
    render(
      <Callout>
        <Callout.Title>Title</Callout.Title>
        <Callout.Dismiss aria-label="Close maintenance notice">
          <svg aria-hidden="true" viewBox="0 0 10 10" />
        </Callout.Dismiss>
      </Callout>,
    );

    expect(screen.getByRole("button", { name: "Close maintenance notice" })).toHaveAttribute(
      "aria-label",
      "Close maintenance notice",
    );
  });

  it("dismiss is focusable and activatable via keyboard", async () => {
    const user = userEvent.setup();
    render(
      <Callout>
        <Callout.Title>Alert</Callout.Title>
        <Callout.Dismiss />
      </Callout>,
    );

    await user.tab();
    expect(screen.getByRole("button", { name: "Dismiss" })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(screen.queryByText("Alert")).not.toBeInTheDocument();
  });

  it("moves focus to a stable target when the callout is dismissed via keyboard", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Callout>
          <Callout.Title>Alert</Callout.Title>
          <Callout.Dismiss />
        </Callout>
        <button type="button">Continue</button>
      </>,
    );

    await user.tab();
    expect(screen.getByRole("button", { name: "Dismiss" })).toHaveFocus();

    await user.keyboard("{Enter}");

    expect(screen.queryByText("Alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toHaveFocus();
  });

  it("skips a recovery control hidden by an ancestor", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Callout>
          <Callout.Title>Alert</Callout.Title>
          <Callout.Dismiss />
        </Callout>
        <div style={{ display: "none" }}>
          <button type="button">Hidden recovery target</button>
        </div>
        <button type="button">Visible recovery target</button>
      </>,
    );

    await user.tab();
    expect(screen.getByRole("button", { name: "Dismiss" })).toHaveFocus();

    await user.keyboard("{Enter}");

    expect(screen.queryByText("Alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Visible recovery target" })).toHaveFocus();
  });

  it("repairs focus to a stable target after dismiss inside an open shadow root (F-070)", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const shadowRoot = host.attachShadow({ mode: "open" });
    const mountPoint = document.createElement("div");
    shadowRoot.append(mountPoint);

    render(
      <Callout>
        <Callout.Title>Alert</Callout.Title>
        <Callout.Dismiss />
      </Callout>,
      { container: mountPoint },
    );

    const recovery = document.createElement("button");
    recovery.type = "button";
    recovery.textContent = "Continue";
    shadowRoot.append(recovery);

    const dismiss = within(mountPoint).getByRole("button", { name: "Dismiss" });
    dismiss.focus();
    expect(shadowRoot.activeElement).toBe(dismiss);

    act(() => {
      dismiss.click();
    });

    expect(within(mountPoint).queryByText("Alert")).not.toBeInTheDocument();
    expect(shadowRoot.activeElement).toBe(recovery);
    host.remove();
  });
});

describe("Callout controlled state", () => {
  it("respects controlled open=false", () => {
    render(
      <Callout open={false}>
        <Callout.Content>hidden</Callout.Content>
      </Callout>,
    );
    expect(screen.queryByText("hidden")).not.toBeInTheDocument();
  });

  it("fires onOpenChange when dismiss is clicked", async () => {
    const user = userEvent.setup();
    let nextOpen: boolean | null = null;
    render(
      <Callout
        open
        onOpenChange={(o) => {
          nextOpen = o;
        }}
      >
        <Callout.Title>Controlled</Callout.Title>
        <Callout.Dismiss />
      </Callout>,
    );
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(nextOpen).toBe(false);
  });
});

describe("Callout accessibility", () => {
  it("icon is aria-hidden and visually-hidden tone prefix is rendered", () => {
    const { container } = render(
      <Callout tone="warning">
        <Callout.Icon />
        <Callout.Title>Heads up</Callout.Title>
      </Callout>,
    );
    const icon = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(icon).not.toBeNull();
    expect(screen.getByText(/Warning:/)).toBeInTheDocument();
  });

  it("has no a11y violations across tones and frames", async () => {
    for (const tone of ["info", "warning", "error", "success"] as const) {
      for (const frame of ["inline", "rail", "bar"] as const) {
        const { container, unmount } = render(
          <Callout tone={tone} frame={frame}>
            <Callout.Icon />
            <Callout.Title>
              {tone} {frame}
            </Callout.Title>
            <Callout.Content>Body for {tone}</Callout.Content>
            <Callout.Dismiss />
          </Callout>,
        );
        expect(await axe(container)).toHaveNoViolations();
        unmount();
      }
    }
  });

  it("has no a11y violations for default, text, icon, and explicitly labelled dismissals", async () => {
    const dismissals = [
      <Callout.Dismiss key="default" />,
      <Callout.Dismiss key="text">Dismiss notice</Callout.Dismiss>,
      <Callout.Dismiss key="icon">
        <svg aria-hidden="true" viewBox="0 0 10 10" />
      </Callout.Dismiss>,
      <Callout.Dismiss key="labelled-icon" aria-label="Close notice">
        <svg aria-hidden="true" viewBox="0 0 10 10" />
      </Callout.Dismiss>,
    ];

    for (const dismiss of dismissals) {
      const { container, unmount } = render(
        <Callout>
          <Callout.Title>Notice</Callout.Title>
          {dismiss}
        </Callout>,
      );
      expect(await axe(container)).toHaveNoViolations();
      unmount();
    }
  });
});
