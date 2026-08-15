import { devices, expect, type Locator, test } from "@playwright/test";

test.use({ ...devices["Pixel 7"] });

const MIN_TARGET_SIZE = 44;

type Axis = "x" | "y";

interface Point {
  x: number;
  y: number;
}

interface Box {
  height: number;
  width: number;
  x: number;
  y: number;
}

async function paintedBox(control: Locator): Promise<Box> {
  await expect(control).toBeVisible();
  await control.scrollIntoViewIfNeeded();
  const box = await control.boundingBox();
  expect(box, "a laid-out control is required for hit-target checks").not.toBeNull();
  return { height: box?.height ?? 0, width: box?.width ?? 0, x: box?.x ?? 0, y: box?.y ?? 0 };
}

function axisGeometry(box: Box, axis: Axis) {
  const size = axis === "y" ? box.height : box.width;
  const start = axis === "y" ? box.y : box.x;
  const cross = Math.round(axis === "y" ? box.x + box.width / 2 : box.y + box.height / 2);
  const at = (row: number): Point => (axis === "y" ? { x: cross, y: row } : { x: row, y: cross });
  return {
    at,
    firstRow: Math.ceil(start),
    lastRow: Math.floor(start + size),
    size,
  };
}

async function reachAt(control: Locator, points: Point[]) {
  return control.evaluate(
    (element, probes: Point[]) =>
      probes.map(({ x, y }) => {
        const hit = document.elementFromPoint(x, y);
        return hit === element || (hit !== null && element.contains(hit));
      }),
    points,
  );
}

async function expectExtendedTarget(control: Locator, axis: Axis) {
  const box = await paintedBox(control);
  const { at, firstRow, lastRow, size } = axisGeometry(box, axis);
  expect(
    size,
    "the pseudo-element extension only applies below the coarse-pointer minimum",
  ).toBeLessThan(MIN_TARGET_SIZE);

  const overhang = Math.floor((MIN_TARGET_SIZE - size) / 2);
  const [beforeEdge, afterEdge, pastBefore, pastAfter] = await reachAt(control, [
    at(firstRow - overhang + 1),
    at(lastRow + overhang - 1),
    at(firstRow - overhang - 2),
    at(lastRow + overhang + 2),
  ]);

  expect(beforeEdge, `tap ${overhang - 1}px before the painted box on ${axis}`).toBe(true);
  expect(afterEdge, `tap ${overhang - 1}px after the painted box on ${axis}`).toBe(true);
  expect(pastBefore, `tap ${overhang + 2}px before the painted box on ${axis}`).toBe(false);
  expect(pastAfter, `tap ${overhang + 2}px after the painted box on ${axis}`).toBe(false);
}

async function parkDismissAtGap(control: Locator, gap: number) {
  return control.evaluate(async (element, offset: number) => {
    const scroller = element.closest<HTMLElement>('[data-testid="callout-clip-frame"]');
    if (scroller === null) throw new Error("expected the dismiss inside the clipping frame");

    const clipTop = () => scroller.getBoundingClientRect().top;
    scroller.scrollTop += element.getBoundingClientRect().top - (clipTop() + offset);

    await new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });

    const box = element.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top - 3);

    return {
      gapToClip: Math.round(box.top - clipTop()),
      reachesAboveBox: hit === element || (hit !== null && element.contains(hit)),
    };
  }, gap);
}

test.describe("Coarse-pointer hit targets", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/testing/fixtures/coarse-hit-targets.html");
    expect(await page.evaluate(() => window.matchMedia("(pointer: coarse)").matches)).toBe(true);
  });

  test("Checkbox and Breadcrumbs.Link render 44px coarse-pointer boxes in adjacent layouts", async ({
    page,
  }) => {
    const cases = [
      {
        name: "standalone checkbox",
        locator: page.getByRole("checkbox", { name: "Standalone checkbox" }),
      },
      {
        name: "adjacent checkbox one",
        locator: page.getByRole("checkbox", { name: "Adjacent checkbox one" }),
      },
      {
        name: "adjacent checkbox two",
        locator: page.getByRole("checkbox", { name: "Adjacent checkbox two" }),
      },
      {
        name: "breadcrumbs home link",
        locator: page.getByRole("link", { name: "Home" }),
      },
      {
        name: "breadcrumbs about link",
        locator: page.getByRole("link", { name: "About" }),
      },
    ] as const;

    const boxes = new Map<string, Box>();
    for (const item of cases) {
      const box = await paintedBox(item.locator);
      boxes.set(item.name, box);
      expect(
        box.height,
        `${item.name} should render at least ${MIN_TARGET_SIZE}px tall`,
      ).toBeGreaterThanOrEqual(MIN_TARGET_SIZE);
    }

    const adjacentOne = boxes.get("adjacent checkbox one");
    const adjacentTwo = boxes.get("adjacent checkbox two");
    expect(adjacentOne, "expected the first adjacent checkbox box").toBeDefined();
    expect(adjacentTwo, "expected the second adjacent checkbox box").toBeDefined();
    expect((adjacentOne?.y ?? 0) + (adjacentOne?.height ?? 0)).toBeLessThanOrEqual(
      adjacentTwo?.y ?? 0,
    );

    const home = boxes.get("breadcrumbs home link");
    const about = boxes.get("breadcrumbs about link");
    expect(home, "expected the Home link box").toBeDefined();
    expect(about, "expected the About link box").toBeDefined();
    expect((home?.x ?? 0) + (home?.width ?? 0)).toBeLessThanOrEqual(about?.x ?? 0);
  });

  test("Callout.Dismiss answers coarse-pointer taps inside its pseudo-element band", async ({
    page,
  }) => {
    const dismiss = page.getByTestId("callout-dismiss-open");

    await expectExtendedTarget(dismiss, "y");
    await expectExtendedTarget(dismiss, "x");
  });

  test("Callout.Dismiss loses its overhang when a clipping ancestor cuts it", async ({ page }) => {
    const dismiss = page.getByTestId("callout-dismiss-clipped");

    const withRoom = await parkDismissAtGap(dismiss, 40);
    expect(
      withRoom.gapToClip,
      "dismiss parked well inside the clipping frame",
    ).toBeGreaterThanOrEqual(8);
    expect(withRoom.reachesAboveBox, "the overhang should answer taps while it has room").toBe(
      true,
    );

    const flush = await parkDismissAtGap(dismiss, 1);
    expect(flush.gapToClip, "dismiss parked against the clip edge").toBeLessThanOrEqual(1);
    expect(flush.reachesAboveBox, "the clipped overhang must not escape above the frame").toBe(
      false,
    );
  });
});
