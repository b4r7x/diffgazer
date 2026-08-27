import { describe, expectTypeOf, it } from "vitest";
import type { RadioGroupItemProps } from "./index";
import type { RadioGroupProps } from "./radio-group";

describe("RadioGroup types", () => {
  it("narrows value/onChange to the supplied literal union", () => {
    type Narrow = RadioGroupProps<"sm" | "md" | "lg">;

    expectTypeOf<Narrow["value"]>().toEqualTypeOf<"sm" | "md" | "lg" | undefined>();
    expectTypeOf<Narrow["defaultValue"]>().toEqualTypeOf<"sm" | "md" | "lg" | undefined>();
    expectTypeOf<NonNullable<Narrow["onChange"]>>()
      .parameter(0)
      .toEqualTypeOf<"sm" | "md" | "lg">();
  });

  it("rejects RadioGroupItem values outside the literal union", () => {
    expectTypeOf<"xl">().not.toMatchTypeOf<RadioGroupItemProps<"sm" | "md" | "lg">["value"]>();
    expectTypeOf<"sm">().toMatchTypeOf<RadioGroupItemProps<"sm" | "md" | "lg">["value"]>();
  });

  it("keeps the loose default contract when no generic is supplied", () => {
    expectTypeOf<RadioGroupProps["value"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<RadioGroupItemProps["value"]>().toEqualTypeOf<string>();
  });
});
