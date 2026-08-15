import type { ReactNode, Ref } from "react";
import { describe, expectTypeOf, it } from "vitest";
import type {
  SidebarItemAsAnchorProps,
  SidebarItemAsButtonProps,
  SidebarItemRenderProps,
} from "./sidebar-item";

describe("SidebarItem render-prop types", () => {
  it("narrows the render ref to HTMLAnchorElement by default", () => {
    expectTypeOf<SidebarItemRenderProps["ref"]>().toEqualTypeOf<
      Ref<HTMLAnchorElement> | undefined
    >();
  });

  it("narrows the render ref to HTMLButtonElement when as is button", () => {
    type ButtonRender = Extract<
      SidebarItemAsButtonProps["children"],
      (props: SidebarItemRenderProps<HTMLButtonElement>) => ReactNode
    >;
    expectTypeOf<ButtonRender>().not.toBeNever();

    expectTypeOf<SidebarItemRenderProps<HTMLButtonElement>["ref"]>().toEqualTypeOf<
      Ref<HTMLButtonElement> | undefined
    >();
  });

  it("keeps anchor render children on the default branch", () => {
    type AnchorRender = Extract<
      SidebarItemAsAnchorProps["children"],
      (props: SidebarItemRenderProps<HTMLAnchorElement>) => ReactNode
    >;
    expectTypeOf<AnchorRender>().not.toBeNever();
  });
});
