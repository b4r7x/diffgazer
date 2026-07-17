import { render, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Popover } from "../popover";
import { Select } from "../select";
import { Portal } from "./portal";

describe("Portal", () => {
  it("renders nothing when no target can be resolved", () => {
    // An explicit null container opts out of the document.body fallback, so the
    // portal has no target and must commit nothing rather than throw.
    const { container } = render(<Portal container={null}>content</Portal>);
    expect(container).toBeEmptyDOMElement();
  });

  it("portals children into an explicit container", () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    try {
      render(<Portal container={target}>portaled</Portal>);
      expect(target).toHaveTextContent("portaled");
    } finally {
      target.remove();
    }
  });

  it("falls back to document.body when no container is provided", () => {
    render(<Portal>body-content</Portal>);
    expect(document.body).toHaveTextContent("body-content");
  });

  it("supports a generic Portal target in another document", () => {
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    const iframeDocument = iframe.contentDocument;
    if (!iframeDocument) throw new Error("Expected iframe document");
    const portalRoot = iframeDocument.createElement("div");
    iframeDocument.body.append(portalRoot);

    const view = render(
      <Portal container={portalRoot}>
        <button type="button">Iframe action</button>
      </Portal>,
    );

    const action = within(portalRoot).getByRole("button", { name: "Iframe action" });
    expect(action.ownerDocument).toBe(iframeDocument);

    view.unmount();
    iframe.remove();
  });

  it("keeps Select ID references in the trigger document when given an iframe container", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    const iframeDocument = iframe.contentDocument;
    if (!iframeDocument) throw new Error("Expected iframe document");

    const view = render(
      <Select defaultOpen>
        <Select.Trigger aria-label="Fruit">
          <Select.Value placeholder="Pick a fruit" />
        </Select.Trigger>
        <Select.Content portalContainer={iframeDocument.body}>
          <Select.Item value="apple">Apple</Select.Item>
        </Select.Content>
      </Select>,
    );

    const trigger = within(view.container).getByRole("combobox", { name: "Fruit" });
    await waitFor(() => {
      const controlledId = trigger.getAttribute("aria-controls");
      expect(controlledId).toBeTruthy();
      expect(controlledId ? document.getElementById(controlledId) : null).toHaveRole("listbox");
    });
    expect(within(iframeDocument.body).queryByRole("listbox")).not.toBeInTheDocument();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Select: portalContainer"));

    view.unmount();
    iframe.remove();
    warn.mockRestore();
  });

  it("keeps hover Popover descriptions in the trigger document", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    const iframeDocument = iframe.contentDocument;
    if (!iframeDocument) throw new Error("Expected iframe document");

    const view = render(
      <Popover defaultOpen triggerMode="hover">
        <Popover.Trigger>More context</Popover.Trigger>
        <Popover.Content portalContainer={iframeDocument.body}>Helpful details</Popover.Content>
      </Popover>,
    );

    const trigger = within(view.container).getByText("More context");
    await waitFor(() => {
      const describedBy = trigger.getAttribute("aria-describedby");
      expect(describedBy).toBeTruthy();
      expect(describedBy ? document.getElementById(describedBy) : null).toHaveRole("tooltip");
    });
    expect(within(iframeDocument.body).queryByRole("tooltip")).not.toBeInTheDocument();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Popover: portalContainer"));

    view.unmount();
    iframe.remove();
    warn.mockRestore();
  });
});
