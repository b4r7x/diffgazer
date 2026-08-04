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

  it("has no a11y violations", async () => {
    const { container } = render(
      <KeyValue layout="horizontal">
        <KeyValue.Item label="Status" value="Ready" />
        <KeyValue.Item label="Owner" value="Docs" />
      </KeyValue>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
