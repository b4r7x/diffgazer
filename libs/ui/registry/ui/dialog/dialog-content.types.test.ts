import type { MouseEvent } from "react";
import { describe, expectTypeOf, it } from "vitest";
import type { DialogContentProps } from "./dialog-content";

describe("DialogContent types", () => {
  it("types inline click handlers against HTMLDivElement", () => {
    type Inline = Extract<DialogContentProps, { modal: false }>;

    expectTypeOf<Inline["onClick"]>().toEqualTypeOf<
      ((event: MouseEvent<HTMLDivElement>) => void) | undefined
    >();
  });

  it("types modal click handlers against HTMLDialogElement", () => {
    type Modal = Extract<DialogContentProps, { modal?: true }>;

    expectTypeOf<Modal["onClick"]>().toEqualTypeOf<
      ((event: MouseEvent<HTMLDialogElement>) => void) | undefined
    >();
  });

  it("rejects modal-only props on inline content", () => {
    type Inline = Extract<DialogContentProps, { modal: false }>;

    expectTypeOf<{ modal: false; initialFocus: { current: null } }>().not.toMatchTypeOf<Inline>();
    expectTypeOf<{ modal: false; closeOnBackdropClick: false }>().not.toMatchTypeOf<Inline>();
    expectTypeOf<{ modal: false; role: "alertdialog" }>().not.toMatchTypeOf<Inline>();
    expectTypeOf<{ modal: false; onCancel: () => void }>().not.toMatchTypeOf<Inline>();
  });
});
