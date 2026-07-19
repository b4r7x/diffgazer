import { describe, expect, test } from "vitest";
import { getListWindow } from "./list-window";

describe("getListWindow", () => {
  test("keeps the top boundary and its down indicator inside the viewport", () => {
    expect(getListWindow({ selectedIndex: 0, total: 10, viewportRows: 5 })).toEqual({
      start: 0,
      end: 4,
      canScrollUp: false,
      canScrollDown: true,
    });
  });

  test("deducts both indicator rows from a middle window", () => {
    expect(getListWindow({ selectedIndex: 6, total: 10, viewportRows: 5 })).toEqual({
      start: 4,
      end: 7,
      canScrollUp: true,
      canScrollDown: true,
    });
  });

  test("clamps the bottom boundary and keeps its up indicator inside the viewport", () => {
    expect(getListWindow({ selectedIndex: 99, total: 10, viewportRows: 5 })).toEqual({
      start: 6,
      end: 10,
      canScrollUp: true,
      canScrollDown: false,
    });
  });

  test("returns an empty window for an empty list or viewport", () => {
    expect(getListWindow({ selectedIndex: 0, total: 0, viewportRows: 5 })).toEqual({
      start: 0,
      end: 0,
      canScrollUp: false,
      canScrollDown: false,
    });
    expect(getListWindow({ selectedIndex: 0, total: 5, viewportRows: 0 })).toEqual({
      start: 0,
      end: 0,
      canScrollUp: false,
      canScrollDown: false,
    });
  });

  test("keeps a content row and truthful boundaries in constrained viewports", () => {
    expect(getListWindow({ selectedIndex: 2, total: 5, viewportRows: 1 })).toEqual({
      start: 2,
      end: 3,
      canScrollUp: false,
      canScrollDown: false,
    });
    expect(getListWindow({ selectedIndex: 2, total: 5, viewportRows: 2 })).toEqual({
      start: 2,
      end: 3,
      canScrollUp: true,
      canScrollDown: true,
    });
  });

  test("caps content rows while keeping indicators inside a larger viewport", () => {
    expect(
      getListWindow({
        selectedIndex: 0,
        total: 20,
        viewportRows: 8,
        maxContentRows: 6,
      }),
    ).toEqual({ start: 0, end: 6, canScrollUp: false, canScrollDown: true });
    expect(
      getListWindow({
        selectedIndex: 8,
        total: 20,
        viewportRows: 8,
        maxContentRows: 6,
      }),
    ).toEqual({ start: 3, end: 9, canScrollUp: true, canScrollDown: true });
  });
});
