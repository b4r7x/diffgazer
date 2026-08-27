import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "../../../testing/axe";
import { KeyValue, keyValueVariants } from "./index";

describe("KeyValue", () => {
  it("renders dt and dd as direct dl children", () => {
    render(
      <KeyValue>
        <KeyValue.Item label="Status" value="Ready" />
        <KeyValue.Item label="Owner" value="Docs" />
      </KeyValue>,
    );

    const list = screen.getByText("Status").closest("dl");
    expect(list).not.toBeNull();
    if (!list) return;
    const children = Array.from(list.children).map((child) => child.tagName.toLowerCase());

    expect(children).toEqual(["dt", "dd", "dt", "dd"]);
    // querySelector retained: HTML rule says <dl> direct children must be <dt>/<dd>; asserting the ABSENCE of any <div> child is the structural contract (no role corresponds to "no div")
    expect(list.querySelector(":scope > div")).toBeNull();
  });

  // jsdom resolves no grid tracks, so the column contract rides on the exported variant (public
  // API): an `auto` label track always fits its own text and `minmax(0,1fr)` leaves the value as
  // the only shrinkable column, so a long value wraps in its own cell instead of painting over the
  // label. Matching the whole grid-cols set also catches a second track utility riding along.
  it("keeps the label track content-sized and the value track the only shrinkable one", () => {
    const horizontal = keyValueVariants({ layout: "horizontal" }).split(" ");

    expect(horizontal.filter((token) => token.startsWith("grid-cols-"))).toEqual([
      "grid-cols-[auto_minmax(0,1fr)]",
    ]);
  });

  it("renders bordered values without wrapping label-value pairs", () => {
    render(
      <KeyValue bordered>
        <KeyValue.Item label="Status" value="Ready" />
        <KeyValue.Item label="Owner" value="Docs" />
      </KeyValue>,
    );

    const list = screen.getByText("Status").closest("dl");
    expect(list).not.toBeNull();
    if (!list) return;
    const children = Array.from(list.children).map((child) => child.textContent);

    expect(children).toEqual(["Status", "Ready", "Owner", "Docs"]);
  });

  it("applies label and value class slots without changing description list semantics", () => {
    render(
      <KeyValue>
        <KeyValue.Item
          label="Status"
          value="Ready"
          className="custom-label"
          valueClassName="custom-value"
        />
      </KeyValue>,
    );

    const label = screen.getByText("Status");
    const value = screen.getByText("Ready");

    expect(label.tagName).toBe("DT");
    expect(value.tagName).toBe("DD");
    // Verifies className (dt) / valueClassName (dd) forwarding contract (not Tailwind internals).
    expect(label).toHaveClass("custom-label");
    expect(value).toHaveClass("custom-value");
    expect(label.nextElementSibling).toBe(value);
  });

  it("renders a description as a second dd for the same term", () => {
    render(
      <KeyValue>
        <KeyValue.Item label="Provider" value="OpenRouter" description="Routes to an upstream." />
        <KeyValue.Item label="Model" value="Sonnet" />
      </KeyValue>,
    );

    const list = screen.getByText("Provider").closest("dl");
    expect(list).not.toBeNull();
    if (!list) return;
    const children = Array.from(list.children).map((child) => [
      child.tagName.toLowerCase(),
      child.textContent,
    ]);

    expect(children).toEqual([
      ["dt", "Provider"],
      ["dd", "OpenRouter"],
      ["dd", "Routes to an upstream."],
      ["dt", "Model"],
      ["dd", "Sonnet"],
    ]);
  });

  it("spans the description across both horizontal tracks and forwards its class slot", () => {
    render(
      <KeyValue>
        <KeyValue.Item
          label="Provider"
          value="OpenRouter"
          description="Routes to an upstream."
          descriptionClassName="custom-description"
        />
      </KeyValue>,
    );

    const description = screen.getByText("Routes to an upstream.");

    expect(description.tagName).toBe("DD");
    // The span is the whole point of the slot: the app must not restate the grid's track count.
    expect(description).toHaveClass("col-span-2");
    expect(description).toHaveClass("custom-description");
  });

  it("omits the description dd when no description is given", () => {
    render(
      <KeyValue>
        <KeyValue.Item label="Provider" value="OpenRouter" />
      </KeyValue>,
    );

    const list = screen.getByText("Provider").closest("dl");
    expect(list).not.toBeNull();
    if (!list) return;

    expect(Array.from(list.children).map((child) => child.tagName.toLowerCase())).toEqual([
      "dt",
      "dd",
    ]);
  });

  it("does not span the description in vertical layout, which has one track", () => {
    render(
      <KeyValue layout="vertical">
        <KeyValue.Item label="Provider" value="OpenRouter" description="Routes to an upstream." />
      </KeyValue>,
    );

    // col-span-2 would overflow the single-track vertical grid.
    expect(screen.getByText("Routes to an upstream.")).not.toHaveClass("col-span-2");
  });

  it("has no a11y violations", async () => {
    const { container } = render(
      <KeyValue layout="horizontal">
        <KeyValue.Item label="Status" value="Ready" description="Last checked a minute ago." />
        <KeyValue.Item label="Owner" value="Docs" />
      </KeyValue>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
