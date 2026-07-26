import { expect, type Locator, test } from "@playwright/test";

/**
 * Controls that paint smaller than a finger extend their tap target with a
 * transparent `::before` (`pointer-coarse:before:-inset-y-*` on Button and Switch).
 * A class-name assertion proves the recipe is attached; it cannot prove a tap in
 * that band reaches the control, because the extension is a pseudo-element and two
 * things eat it silently: an `overflow: hidden` ancestor clips it, and a
 * later-painted sibling covers it. Both leave the class in place.
 *
 * So these specs tap-test the geometry with `elementFromPoint`. `mobile-chromium`
 * proves the extended branch; `chromium` proves the fine-pointer branch is the
 * painted box and nothing more, which puts the media query itself under contract.
 */
const MOBILE_PROJECT = "mobile-chromium";

/** WCAG 2.5.8 (minimum) target size — the value the coarse-pointer extensions aim at. */
const MIN_TARGET_SIZE = 44;

/** Probe distance for "just outside the painted box" on a fine pointer. */
const FINE_POINTER_PROBE = 3;

type Axis = "x" | "y";

/** What a tap at a point actually reaches. */
type Reach = "target" | "inert" | "other-control" | "nothing";

const INTERACTIVE_SELECTOR =
  "a[href],button,input,select,textarea,summary,[role=button],[role=link],[role=switch],[role=checkbox],[role=tab],[role=option],[role=menuitem]";

interface Point {
  x: number;
  y: number;
}

async function reachAt(control: Locator, points: Point[]): Promise<Reach[]> {
  return control.evaluate(
    (element, probes: { interactive: string; points: Point[] }) =>
      probes.points.map(({ x, y }): Reach => {
        const hit = document.elementFromPoint(x, y);
        if (hit === element || (hit !== null && element.contains(hit))) return "target";
        if (hit === null) return "nothing";
        return hit.closest(probes.interactive) === null ? "inert" : "other-control";
      }),
    { interactive: INTERACTIVE_SELECTOR, points },
  );
}

async function paintedBox(control: Locator) {
  await expect(control).toBeVisible();
  await control.scrollIntoViewIfNeeded();
  const box = await control.boundingBox();
  expect(box, "a control has to be laid out before it can be tapped").not.toBeNull();
  return { height: box?.height ?? 0, width: box?.width ?? 0, x: box?.x ?? 0, y: box?.y ?? 0 };
}

/**
 * Probes are addressed in whole pixel rows: `elementFromPoint` resolves to the
 * nearest one, and every control here sits on a fractional offset, so a fractional
 * probe would be reporting where the layout happened to land rather than how far the
 * control reaches. `firstRow`/`lastRow` are the rows the painted box occupies.
 */
function axisGeometry(box: { height: number; width: number; x: number; y: number }, axis: Axis) {
  const size = axis === "y" ? box.height : box.width;
  const start = axis === "y" ? box.y : box.x;
  const cross = Math.round(axis === "y" ? box.x + box.width / 2 : box.y + box.height / 2);
  const at = (row: number): Point => (axis === "y" ? { x: cross, y: row } : { x: row, y: cross });
  return { at, firstRow: Math.ceil(start), lastRow: Math.floor(start + size), size };
}

/**
 * Asserts the control answers taps out to the overhang its size prescribes — the
 * distance that takes the painted box to `MIN_TARGET_SIZE` — and stops there. The
 * probes sit one row inside and two rows outside that distance, which is the span
 * sub-pixel placement can move an edge by.
 */
async function expectExtendedTarget(control: Locator, axis: Axis) {
  const box = await paintedBox(control);
  const { at, firstRow, lastRow, size } = axisGeometry(box, axis);
  expect(
    size,
    "the extension only has a job while the painted box is under the minimum",
  ).toBeLessThan(MIN_TARGET_SIZE);

  const overhang = Math.floor((MIN_TARGET_SIZE - size) / 2);
  const [beforeEdge, afterEdge, pastBefore, pastAfter] = await reachAt(control, [
    at(firstRow - overhang + 1),
    at(lastRow + overhang - 1),
    at(firstRow - overhang - 2),
    at(lastRow + overhang + 2),
  ]);

  expect(beforeEdge, `tap ${overhang - 1}px before the painted box on ${axis}`).toBe("target");
  expect(afterEdge, `tap ${overhang - 1}px after the painted box on ${axis}`).toBe("target");
  expect(pastBefore, `tap ${overhang + 2}px before the painted box on ${axis}`).not.toBe("target");
  expect(pastAfter, `tap ${overhang + 2}px after the painted box on ${axis}`).not.toBe("target");
}

/** The complement: on a fine pointer the painted box is the whole target. */
async function expectPaintedBoxIsTheTarget(control: Locator, axis: Axis) {
  const box = await paintedBox(control);
  const { at, firstRow, lastRow } = axisGeometry(box, axis);
  const [before, after] = await reachAt(control, [
    at(firstRow - FINE_POINTER_PROBE),
    at(lastRow + FINE_POINTER_PROBE),
  ]);
  expect(before, `tap ${FINE_POINTER_PROBE}px before the painted box on ${axis}`).not.toBe(
    "target",
  );
  expect(after, `tap ${FINE_POINTER_PROBE}px after the painted box on ${axis}`).not.toBe("target");
}

/**
 * A neighbour painting over part of the band costs reach, which is a call-site
 * problem. A *different control* inside the band is a correctness problem: it turns
 * a near-miss into a tap on the wrong thing. Only the second one is asserted here.
 */
async function expectBandFreeOfOtherControls(control: Locator, axis: Axis) {
  const box = await paintedBox(control);
  const { at, firstRow, lastRow, size } = axisGeometry(box, axis);
  const overhang = Math.floor((MIN_TARGET_SIZE - size) / 2);

  const rows: number[] = [];
  for (let row = firstRow - overhang; row <= lastRow + overhang; row += 1) rows.push(row);
  const reaches = await reachAt(control, rows.map(at));
  const stolen = rows.filter((_, index) => reaches[index] === "other-control");
  expect(stolen, `rows inside the ${MIN_TARGET_SIZE}px band that reach another control`).toEqual(
    [],
  );
}

test.describe("Coarse-pointer hit areas", () => {
  test("extends the sm button vertically only, out to 44px", async ({ page }, testInfo) => {
    const coarse = testInfo.project.name === MOBILE_PROJECT;
    await page.goto("/ui/components/button");
    expect(await page.evaluate(() => window.matchMedia("(pointer: coarse)").matches)).toBe(coarse);

    // The demo preview's own "copy tsx" control: a size="sm" ghost Button painting
    // 28px tall in a panel footer, with nothing interactive above or below it.
    const control = page
      .locator('[data-slot="panel-footer"]')
      .getByRole("button", { name: "Copy to clipboard" })
      .first();

    if (!coarse) {
      await expectPaintedBoxIsTheTarget(control, "y");
      return;
    }

    await expectExtendedTarget(control, "y");
    await expectBandFreeOfOtherControls(control, "y");
    // `inset-x-0`: the sm extension is vertical only, which is what makes horizontal
    // neighbours safe at any gap. Pin it so the recipe cannot quietly grow sideways.
    await expectPaintedBoxIsTheTarget(control, "x");
  });

  test("extends the icon button to 44px on both axes", async ({ page }, testInfo) => {
    const coarse = testInfo.project.name === MOBILE_PROJECT;
    await page.goto("/ui/components/button");
    expect(await page.evaluate(() => window.matchMedia("(pointer: coarse)").matches)).toBe(coarse);

    // The dgadd install row's copy control: a size="icon" Button painting 36x36 with
    // room around it on every side.
    const control = page
      .getByRole("tabpanel", { name: /dgadd/i })
      .getByRole("button", { name: "Copy to clipboard" });

    if (!coarse) {
      await expectPaintedBoxIsTheTarget(control, "y");
      await expectPaintedBoxIsTheTarget(control, "x");
      return;
    }

    await expectExtendedTarget(control, "y");
    await expectExtendedTarget(control, "x");
    await expectBandFreeOfOtherControls(control, "y");
  });

  test("extends the switch to 44px around its 24px track", async ({ page }, testInfo) => {
    const coarse = testInfo.project.name === MOBILE_PROJECT;
    await page.goto("/ui/components/switch");
    expect(await page.evaluate(() => window.matchMedia("(pointer: coarse)").matches)).toBe(coarse);

    const control = page.getByRole("switch", { name: "Enable review notifications" }).first();

    if (!coarse) {
      await expectPaintedBoxIsTheTarget(control, "y");
      return;
    }

    await expectExtendedTarget(control, "y");
    await expectBandFreeOfOtherControls(control, "y");
  });

  test("lets a clipping ancestor cut the extension instead of escaping it", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== MOBILE_PROJECT,
      "there is no extension to clip on a fine pointer",
    );
    await page.goto("/ui/components/button");

    const control = page
      .getByRole("tabpanel", { name: /dgadd/i })
      .getByRole("button", { name: "Copy to clipboard" });
    await expect(control).toBeVisible();

    // Button's own doc comment states this precondition in prose: the overhang has to
    // fit inside the nearest clipped ancestor or the target shrinks back to the box.
    // Park the control at a chosen distance below its scroll container's clip edge and
    // ask what a tap 3px above the painted box actually reaches.
    const probeAboveBox = async (gap: number) =>
      control.evaluate(async (element, offset: number) => {
        const scroller = element.closest<HTMLElement>("#main-content");
        if (scroller === null) throw new Error("expected the control inside #main-content");
        const clipTop = () => scroller.getBoundingClientRect().top;
        scroller.scrollTop += element.getBoundingClientRect().top - (clipTop() + offset);
        await new Promise((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(resolve));
        });
        const box = element.getBoundingClientRect();
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top - 3);
        return {
          gapToClip: Math.round(box.top - clipTop()),
          reachesControl: hit === element || (hit !== null && element.contains(hit)),
        };
      }, gap);

    const withRoom = await probeAboveBox(40);
    expect(withRoom.gapToClip, "control parked well inside the clip").toBeGreaterThanOrEqual(8);
    expect(withRoom.reachesControl, "the overhang answers taps when it has room").toBe(true);

    const flush = await probeAboveBox(1);
    expect(flush.gapToClip, "control parked against the clip edge").toBeLessThanOrEqual(1);
    expect(
      flush.reachesControl,
      "the overhang is cut by the clip rather than reaching over the chrome above it",
    ).toBe(false);
  });
});
