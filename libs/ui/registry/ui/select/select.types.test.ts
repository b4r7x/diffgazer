import type { ReactNode } from "react";
import { describe, expect, expectTypeOf, it } from "vitest";
import { selectDoc } from "../../component-docs/select";
import type { SelectProps, SelectTagsProps, SelectValueProps } from "./index";
import type { SelectItemProps } from "./select-item";

describe("Select types", () => {
  it("keeps placeholder types aligned with public metadata", () => {
    expectTypeOf<SelectTagsProps["placeholder"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<SelectValueProps["placeholder"]>().toEqualTypeOf<ReactNode>();

    expect(selectDoc.props?.SelectTags?.placeholder).toMatchObject({
      type: "string",
      required: false,
      defaultValue: '"Select..."',
    });
    expect(selectDoc.props?.SelectValue?.placeholder).toMatchObject({
      type: "ReactNode",
      required: false,
      defaultValue: '"Select..."',
    });
  });

  it("accepts only a render function as SelectValue children", () => {
    expectTypeOf<NonNullable<ReactNode>>().not.toMatchTypeOf<
      NonNullable<SelectValueProps["children"]>
    >();
  });

  it("narrows value/onChange in single mode to the supplied union", () => {
    type SingleNarrow = Extract<SelectProps<"a" | "b">, { multiple?: false }>;

    expectTypeOf<SingleNarrow["value"]>().toEqualTypeOf<"a" | "b" | undefined>();
    expectTypeOf<SingleNarrow["defaultValue"]>().toEqualTypeOf<"a" | "b" | undefined>();
    expectTypeOf<NonNullable<SingleNarrow["onChange"]>>().parameter(0).toEqualTypeOf<"a" | "b">();
  });

  it("narrows value/onChange in multiple mode to the supplied union", () => {
    type MultiNarrow = Extract<SelectProps<"a" | "b">, { multiple: true }>;

    expectTypeOf<MultiNarrow["value"]>().toEqualTypeOf<("a" | "b")[] | undefined>();
    expectTypeOf<NonNullable<MultiNarrow["onChange"]>>()
      .parameter(0)
      .toEqualTypeOf<("a" | "b")[]>();
  });

  it("rejects SelectItem values outside the literal union", () => {
    expectTypeOf<"c">().not.toMatchTypeOf<SelectItemProps<"a" | "b">["value"]>();
    expectTypeOf<"a">().toMatchTypeOf<SelectItemProps<"a" | "b">["value"]>();
  });

  it("keeps the loose default contract when no generic is supplied", () => {
    type Single = Extract<SelectProps, { multiple?: false }>;
    expectTypeOf<Single["value"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<SelectItemProps["value"]>().toEqualTypeOf<string>();
  });
});
