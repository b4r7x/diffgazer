import { describe, expectTypeOf, it } from "vitest";
import type { TabsProps } from "./tabs";
import type { TabsTriggerProps } from "./tabs-trigger";

describe("Tabs types", () => {
  it("narrows value to the supplied literal union", () => {
    type Narrow = TabsProps<"preview" | "code">;

    expectTypeOf<Narrow["value"]>().toEqualTypeOf<"preview" | "code" | undefined>();
    expectTypeOf<Narrow["defaultValue"]>().toEqualTypeOf<"preview" | "code" | undefined>();
    expectTypeOf<NonNullable<Narrow["onChange"]>>()
      .parameter(0)
      .toEqualTypeOf<"preview" | "code">();
  });

  it("rejects TabsTrigger values outside the literal union", () => {
    type Trigger = TabsTriggerProps<"preview" | "code">;

    expectTypeOf<Trigger["value"]>().toEqualTypeOf<"preview" | "code">();
    expectTypeOf<"tests">().not.toMatchTypeOf<Trigger["value"]>();
    expectTypeOf<"preview">().toMatchTypeOf<Trigger["value"]>();
  });

  it("keeps the loose default contract when no generic is supplied", () => {
    expectTypeOf<TabsProps["value"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<TabsTriggerProps["value"]>().toEqualTypeOf<string>();
  });

  it("does not expose a polymorphic render or asChild escape hatch on Tabs.Trigger", () => {
    // WAI-ARIA forbids role="tab" from navigating URLs, so Tabs.Trigger must not
    // be swappable into <a> via render/asChild.
    expectTypeOf<TabsTriggerProps>().toHaveProperty("value");
    expectTypeOf<TabsTriggerProps>().not.toHaveProperty("render");
    expectTypeOf<TabsTriggerProps>().not.toHaveProperty("asChild");
  });
});
