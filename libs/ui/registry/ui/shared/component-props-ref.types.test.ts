import type { ComponentProps, Ref } from "react";
import { describe, expectTypeOf, it } from "vitest";
import type { Callout } from "../callout/index";
import type { Dialog } from "../dialog/index";
import type { Panel } from "../panel/index";

describe("compound part ref typing", () => {
  it("accepts an element-typed ref on every compound part", () => {
    expectTypeOf<ComponentProps<typeof Dialog.Title>["ref"]>().toMatchTypeOf<
      Ref<HTMLHeadingElement> | undefined
    >();
    expectTypeOf<ComponentProps<typeof Dialog.Header>["ref"]>().toMatchTypeOf<
      Ref<HTMLDivElement> | undefined
    >();
    expectTypeOf<ComponentProps<typeof Dialog.Footer>["ref"]>().toMatchTypeOf<
      Ref<HTMLDivElement> | undefined
    >();
    expectTypeOf<ComponentProps<typeof Dialog.Body>["ref"]>().toMatchTypeOf<
      Ref<HTMLDivElement> | undefined
    >();
    expectTypeOf<ComponentProps<typeof Dialog.Description>["ref"]>().toMatchTypeOf<
      Ref<HTMLParagraphElement> | undefined
    >();
    expectTypeOf<ComponentProps<typeof Dialog.KeyboardHints>["ref"]>().toMatchTypeOf<
      Ref<HTMLDivElement> | undefined
    >();
    expectTypeOf<ComponentProps<typeof Callout.Title>["ref"]>().toMatchTypeOf<
      Ref<HTMLSpanElement> | undefined
    >();
    expectTypeOf<ComponentProps<typeof Callout.Icon>["ref"]>().toMatchTypeOf<
      Ref<HTMLSpanElement> | undefined
    >();
    expectTypeOf<ComponentProps<typeof Callout.Content>["ref"]>().toMatchTypeOf<
      Ref<HTMLDivElement> | undefined
    >();
    expectTypeOf<ComponentProps<typeof Panel.Header>["ref"]>().toMatchTypeOf<
      Ref<HTMLDivElement> | undefined
    >();
    expectTypeOf<ComponentProps<typeof Panel.Title>["ref"]>().toMatchTypeOf<
      Ref<HTMLHeadingElement> | undefined
    >();
    expectTypeOf<ComponentProps<typeof Panel.Description>["ref"]>().toMatchTypeOf<
      Ref<HTMLParagraphElement> | undefined
    >();
  });
});
