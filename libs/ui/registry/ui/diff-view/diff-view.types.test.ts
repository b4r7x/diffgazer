import type { ReactNode } from "react";
import { describe, expectTypeOf, it } from "vitest";
import type { DiffViewProps } from "./diff-view";

describe("DiffView types", () => {
  it("accepts statusBar only when variant is statusbar", () => {
    expectTypeOf<{
      patch: string;
      variant: "statusbar";
      statusBar: ReactNode;
    }>().toMatchTypeOf<DiffViewProps>();
    expectTypeOf<{ patch: string; variant: "statusbar" }>().toMatchTypeOf<DiffViewProps>();
  });

  it("rejects statusBar on non-statusbar variants", () => {
    expectTypeOf<{ patch: string; statusBar: ReactNode }>().not.toMatchTypeOf<DiffViewProps>();
    expectTypeOf<{
      patch: string;
      variant: "hairline";
      statusBar: ReactNode;
    }>().not.toMatchTypeOf<DiffViewProps>();
    expectTypeOf<{
      patch: string;
      variant: "bare";
      statusBar: ReactNode;
    }>().not.toMatchTypeOf<DiffViewProps>();
  });
});
