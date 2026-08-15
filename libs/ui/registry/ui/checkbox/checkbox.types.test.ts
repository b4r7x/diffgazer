import { describe, expectTypeOf, it } from "vitest";
import type { CheckboxGroupProps } from "./index";

describe("CheckboxGroup types", () => {
  it("exposes the string values produced by checkbox items without a generic assertion", () => {
    expectTypeOf<CheckboxGroupProps["value"]>().toEqualTypeOf<string[] | undefined>();
    expectTypeOf<CheckboxGroupProps["defaultValue"]>().toEqualTypeOf<string[] | undefined>();
    expectTypeOf<NonNullable<CheckboxGroupProps["onChange"]>>()
      .parameter(0)
      .toEqualTypeOf<string[]>();
  });
});
