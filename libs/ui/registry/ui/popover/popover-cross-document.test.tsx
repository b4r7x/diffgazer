import { fireEvent, render, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { Popover } from "./index";
import { expectClosedOrUnmounted, setPointerEventSupport } from "./popover-test-utils";

let restorePointerEventSupport = () => {};

beforeEach(() => {
  restorePointerEventSupport = setPointerEventSupport(false);
});

afterEach(() => {
  restorePointerEventSupport();
});

function createSameOriginIframe() {
  const iframe = document.createElement("iframe");
  document.body.appendChild(iframe);
  const iframeDoc = iframe.contentDocument;
  if (!iframeDoc) {
    iframe.remove();
    throw new Error("iframe.contentDocument is null; cannot exercise cross-document popover");
  }
  const mount = iframeDoc.createElement("div");
  const portalRoot = iframeDoc.createElement("div");
  iframeDoc.body.append(mount, portalRoot);
  return { iframe, iframeDoc, mount, portalRoot };
}

describe("Popover cross-document behavior", () => {
  it("has no a11y violations for content rendered into an explicit portalContainer", async () => {
    const portalHost = document.createElement("div");
    portalHost.id = "popover-portal-host-axe";
    document.body.appendChild(portalHost);

    render(
      <Popover triggerMode="click" defaultOpen>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Content portalContainer={portalHost} aria-label="Popover menu">
          Portaled body
        </Popover.Content>
      </Popover>,
    );

    expect(await axe(portalHost)).toHaveNoViolations();
    portalHost.remove();
  });

  it("closes click-mode popover when focus leaves its pair in the trigger ownerDocument", () => {
    const onOpenChange = vi.fn();
    const { iframe, iframeDoc, mount, portalRoot } = createSameOriginIframe();

    render(
      <div>
        <button type="button">Outside</button>
        <Popover triggerMode="click" open onOpenChange={onOpenChange}>
          <Popover.Trigger>Open</Popover.Trigger>
          <Popover.Content portalContainer={portalRoot} autoFocus={false}>
            <button type="button">Popover action</button>
          </Popover.Content>
        </Popover>
      </div>,
      { container: mount },
    );

    const trigger = within(iframeDoc.body).getByRole("button", { name: "Open" });
    const outside = within(iframeDoc.body).getByRole("button", { name: "Outside" });
    trigger.focus();
    outside.focus();

    expect(onOpenChange).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    iframe.remove();
  });

  it("closes click-mode popover on outside pointerdown in the trigger ownerDocument", () => {
    const { iframe, iframeDoc, mount, portalRoot } = createSameOriginIframe();

    render(
      <div>
        <button type="button">Outside</button>
        <Popover triggerMode="click" defaultOpen>
          <Popover.Trigger>Open</Popover.Trigger>
          <Popover.Content portalContainer={portalRoot} aria-label="Popover menu">
            Popover body
          </Popover.Content>
        </Popover>
      </div>,
      { container: mount },
    );

    const outside = within(iframeDoc.body).getByRole("button", { name: "Outside" });
    const content = within(portalRoot).getByText("Popover body");
    // fireEvent retained: pointerdown targets the iframe ownerDocument listener without synthesizing unrelated click events.
    fireEvent.pointerDown(outside);
    expectClosedOrUnmounted(content);

    iframe.remove();
  });

  it("closes hover-mode popover on outside pointerdown in the trigger ownerDocument", () => {
    const { iframe, iframeDoc, mount, portalRoot } = createSameOriginIframe();

    render(
      <div>
        <button type="button">Outside</button>
        <Popover triggerMode="hover" defaultOpen>
          <Popover.Trigger>Passive label</Popover.Trigger>
          <Popover.Content portalContainer={portalRoot}>Tooltip body</Popover.Content>
        </Popover>
      </div>,
      { container: mount },
    );

    const tooltip = within(portalRoot).getByRole("tooltip");
    // fireEvent retained: pointerdown targets the trigger ownerDocument listener for hover-mode outside dismissal.
    fireEvent.pointerDown(within(iframeDoc.body).getByRole("button", { name: "Outside" }));
    expectClosedOrUnmounted(tooltip);

    iframe.remove();
  });

  it("renders content into an explicit portalContainer", () => {
    const portalHost = document.createElement("div");
    portalHost.id = "popover-portal-host";
    document.body.appendChild(portalHost);

    render(
      <Popover triggerMode="click" defaultOpen>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Content portalContainer={portalHost} aria-label="Popover menu">
          Portaled body
        </Popover.Content>
      </Popover>,
    );

    expect(within(portalHost).getByText("Portaled body")).toBeInTheDocument();

    portalHost.remove();
  });
});
