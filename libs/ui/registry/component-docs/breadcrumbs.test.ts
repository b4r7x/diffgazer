import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";
import type { Breadcrumbs } from "../ui/breadcrumbs";
import { breadcrumbsDoc } from "./breadcrumbs";

const ellipsisProps = ["label", "children"] as const satisfies readonly (keyof ComponentProps<
  typeof Breadcrumbs.Ellipsis
>)[];

describe("breadcrumbsDoc", () => {
  it("keeps the curated Breadcrumbs.Ellipsis API table exact", () => {
    expect(Object.keys(breadcrumbsDoc.props?.["Breadcrumbs.Ellipsis"] ?? {})).toEqual([
      ...ellipsisProps,
    ]);
  });
});
