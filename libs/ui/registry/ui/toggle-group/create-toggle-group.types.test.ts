import { describe, expectTypeOf, it } from "vitest";
import { createToggleGroup } from "./create-toggle-group";

describe("createToggleGroup types", () => {
  const SeverityGroup = createToggleGroup(["error", "warning", "info"] as const);
  type Severity = (typeof SeverityGroup.values)[number];

  it("narrows single-mode value/onChange to the bound collection", () => {
    type SingleProps = Parameters<typeof SeverityGroup>[0] & {
      selectionMode?: "single" | undefined;
    };

    expectTypeOf<SingleProps["value"]>().toEqualTypeOf<Severity | null | undefined>();
    expectTypeOf<NonNullable<SingleProps["onChange"]>>()
      .parameter(0)
      .toEqualTypeOf<Severity | null>();
  });

  it("rejects item values outside the bound collection", () => {
    type ItemProps = Parameters<typeof SeverityGroup.Item>[0];

    expectTypeOf<ItemProps["value"]>().toEqualTypeOf<Severity>();
    expectTypeOf<"typo">().not.toMatchTypeOf<ItemProps["value"]>();
    expectTypeOf<"error">().toMatchTypeOf<ItemProps["value"]>();
  });
});
