import { expect, type Locator, test } from "@playwright/test";

/**
 * Textarea's unit tests already pin the DOM contract — which slots exist, which
 * `data-handle` each edge renders, what a mark says. None of that can prove the
 * thing this component is actually about: the resize chrome sits *outside* the
 * field, so it never paints over the text or steals a click from it. jsdom
 * computes no layout, so only a browser can answer that, and only with real
 * bounding boxes and real hit tests.
 */

/** Label of the example that gives each edge its own handle kind. */
const BOTH_AXES = "Both, one handle per edge";

/** The band each resizable edge reserves outside the field. */
const BAND = 16;

/** The `line` mark: a 30x1 rule held this far clear of the border. */
const LINE_LENGTH = 30;
const LINE_CLEARANCE = 10;

/** The `box` chip, which is centred on the border rather than held off it. */
const CHIP = 20;

/**
 * Sub-pixel slack. Edges land on fractional rows, so "touching" is never exactly
 * equal; a real regression — a chip re-centred on the border — reaches 10px in.
 */
const EDGE_TOLERANCE = 0.5;

interface TextareaMetrics {
  fontSize: number;
  paddingLeft: number;
  paddingTop: number;
  minHeight: number;
  resize: string;
  overflowX: string;
  overflowY: string;
  scrollbarGutter: string;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}

interface ResizeEdge {
  axis: string;
  /** The invisible hit band, which is the button the pointer grabs. */
  band: Rect;
  /** The mark painted inside the band. */
  handle: { kind: string; text: string; rect: Rect };
}

interface ResizeGeometry {
  /** The root, which owns the applied width and the reserved bands. */
  root: Rect;
  /** The textarea's border box. */
  field: Rect;
  /** The box the text is painted in, once border, padding and gutter are gone. */
  content: Rect;
  lineHeight: number;
  edges: ResizeEdge[];
}

/** What a click at a point would actually reach. */
type Reach = "field" | "resize-chrome" | "other";

async function readMetrics(textarea: Locator): Promise<TextareaMetrics> {
  return textarea.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      fontSize: Number.parseFloat(style.fontSize),
      paddingLeft: Number.parseFloat(style.paddingLeft),
      paddingTop: Number.parseFloat(style.paddingTop),
      minHeight: Number.parseFloat(style.minHeight),
      resize: style.resize,
      overflowX: style.overflowX,
      overflowY: style.overflowY,
      scrollbarGutter: style.scrollbarGutter,
    };
  });
}

function getTextareaRoot(textarea: Locator) {
  return textarea.locator('xpath=ancestor::*[@data-slot="textarea-root"]');
}

/**
 * Measures the field and every piece of chrome around it in one pass, so nothing
 * can shift between two reads.
 */
async function readResizeGeometry(textarea: Locator): Promise<ResizeGeometry> {
  await expect(textarea).toBeVisible();
  return textarea.evaluate((element) => {
    // Park the field mid-viewport first: the docs chrome is sticky, and a hit
    // test underneath it would report the header instead of what covers the field.
    element.scrollIntoView({ block: "center" });

    const root = element.closest('[data-slot="textarea-root"]');
    if (root === null) throw new Error("expected the textarea inside a textarea-root");

    const rectOf = (box: DOMRect): Rect => ({
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
    });
    const style = getComputedStyle(element);
    const field = element.getBoundingClientRect();
    const paddingLeft = Number.parseFloat(style.paddingLeft);
    const paddingTop = Number.parseFloat(style.paddingTop);

    return {
      root: rectOf(root.getBoundingClientRect()),
      field: rectOf(field),
      // clientWidth/clientHeight already exclude the border and the stable
      // scrollbar gutter, which leaves the padding to take off by hand.
      content: {
        x: field.x + Number.parseFloat(style.borderLeftWidth) + paddingLeft,
        y: field.y + Number.parseFloat(style.borderTopWidth) + paddingTop,
        width: element.clientWidth - paddingLeft - Number.parseFloat(style.paddingRight),
        height: element.clientHeight - paddingTop - Number.parseFloat(style.paddingBottom),
      },
      lineHeight: Number.parseFloat(style.lineHeight),
      edges: Array.from(root.querySelectorAll('[data-slot="textarea-resizer"]')).map((band) => {
        const mark = band.querySelector('[data-slot="textarea-resize-handle"]');
        if (mark === null) throw new Error("expected a mark inside every resizer");
        return {
          axis: band.getAttribute("data-axis") ?? "",
          band: rectOf(band.getBoundingClientRect()),
          handle: {
            kind: mark.getAttribute("data-handle") ?? "",
            text: mark.textContent ?? "",
            rect: rectOf(mark.getBoundingClientRect()),
          },
        };
      }),
    };
  });
}

function edgeOf(geometry: ResizeGeometry, axis: "vertical" | "horizontal"): ResizeEdge {
  const edge = geometry.edges.find((candidate) => candidate.axis === axis);
  if (edge === undefined) throw new Error(`expected a ${axis} resizer`);
  return edge;
}

/** Every piece of resize chrome: the bands and the marks they carry. */
function chromeOf(geometry: ResizeGeometry) {
  return geometry.edges.flatMap((edge) => [
    { rect: edge.band, what: `the ${edge.axis} band` },
    { rect: edge.handle.rect, what: `the ${edge.axis} ${edge.handle.kind} mark` },
  ]);
}

/** How far `chrome` reaches into `field`, in pixels. Boxes that only touch reach 0. */
function intrusion(field: Rect, chrome: Rect) {
  const across =
    Math.min(field.x + field.width, chrome.x + chrome.width) - Math.max(field.x, chrome.x);
  const down =
    Math.min(field.y + field.height, chrome.y + chrome.height) - Math.max(field.y, chrome.y);
  return Math.max(0, Math.min(across, down));
}

function centreOf(rect: Rect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

async function reachAt(textarea: Locator, points: Point[]): Promise<Reach[]> {
  return textarea.evaluate(
    (element, probes: Point[]) =>
      probes.map(({ x, y }): Reach => {
        const hit = document.elementFromPoint(x, y);
        if (hit === element) return "field";
        if (hit?.closest('[data-slot="textarea-resizer"]') != null) return "resize-chrome";
        return "other";
      }),
    points,
  );
}

test.describe("Textarea sizes", () => {
  test("Small, Medium, and Large scale padding, font size, and minimum height while the separate handle owns resizing", async ({
    page,
  }) => {
    await page.goto("/ui/components/textarea");
    await expect(page.getByRole("heading", { level: 1, name: /textarea/i })).toBeVisible();

    const small = await readMetrics(page.getByRole("textbox", { name: "Small" }));
    const medium = await readMetrics(page.getByRole("textbox", { name: "Medium (default)" }));
    const large = await readMetrics(page.getByRole("textbox", { name: "Large" }));

    expect(small.fontSize).toBeLessThan(medium.fontSize);
    expect(medium.fontSize).toBeLessThan(large.fontSize);
    expect(small.paddingLeft).toBeLessThan(medium.paddingLeft);
    expect(medium.paddingLeft).toBeLessThan(large.paddingLeft);
    expect(small.paddingTop).toBeLessThan(medium.paddingTop);

    // The minimum height scales with the size too, so it is an ordering contract,
    // not a shared constant.
    expect(small.minHeight).toBeGreaterThan(0);
    expect(small.minHeight).toBeLessThan(medium.minHeight);
    expect(medium.minHeight).toBeLessThan(large.minHeight);

    const textareas = page.getByRole("textbox");
    const count = await textareas.count();
    expect(count).toBeGreaterThanOrEqual(6);

    for (let index = 0; index < count; index += 1) {
      const textarea = textareas.nth(index);
      const metrics = await readMetrics(textarea);
      expect(metrics.minHeight).toBeGreaterThanOrEqual(small.minHeight);
      expect(metrics.resize).toBe("none");
      expect(metrics.overflowX).toBe("auto");
      expect(metrics.overflowY).toBe("auto");
      expect(metrics.scrollbarGutter).toBe("stable");
    }

    for (const textarea of [
      page.getByRole("textbox", { name: "Small" }),
      page.getByRole("textbox", { name: "Medium (default)" }),
      page.getByRole("textbox", { name: "Large" }),
    ]) {
      await expect(
        getTextareaRoot(textarea).getByRole("button", { name: "Resize textarea vertically" }),
      ).toBeVisible();
    }
  });

  test("resizes vertically without covering the scroll area", async ({ page }) => {
    await page.goto("/ui/components/textarea");
    const textarea = page.getByRole("textbox", { name: "Commit message" });
    const resizer = getTextareaRoot(textarea).getByRole("button", {
      name: "Resize textarea vertically",
    });

    const before = await readResizeGeometry(textarea);
    const band = edgeOf(before, "vertical").band;
    expect(band.height).toBe(BAND);
    expect(intrusion(before.field, band), "the band before the drag").toBeLessThanOrEqual(
      EDGE_TOLERANCE,
    );

    const grip = centreOf(band);
    await page.mouse.move(grip.x, grip.y);
    await page.mouse.down();
    await page.mouse.move(grip.x, grip.y + 40);
    await expect(resizer).toHaveAttribute("data-state", "active");
    await page.mouse.up();
    await expect(resizer).not.toHaveAttribute("data-state", "active");

    const after = await readResizeGeometry(textarea);
    expect(after.field.height).toBeGreaterThan(before.field.height);
    // The drag has to move the band down with the field. Letting the field grow
    // under a band that stayed put is exactly how the chrome ends up over the text.
    expect(
      intrusion(after.field, edgeOf(after, "vertical").band),
      "the band after the drag",
    ).toBeLessThanOrEqual(EDGE_TOLERANCE);
  });

  test("resizes horizontally and exposes both axes independently", async ({ page }) => {
    await page.goto("/ui/components/textarea");
    const horizontal = page.getByRole("textbox", { name: "Horizontal" });

    const before = await readResizeGeometry(horizontal);
    const edge = edgeOf(before, "horizontal");
    const fieldRight = before.field.x + before.field.width;
    expect(edge.band.width).toBe(BAND);
    expect(intrusion(before.field, edge.band), "the horizontal band").toBeLessThanOrEqual(
      EDGE_TOLERANCE,
    );

    // The default handle is a wordless rule held clear of the border, not a chip
    // sitting on it: nothing to read, and nothing painted over the field.
    expect(edge.handle.kind).toBe("line");
    expect(edge.handle.text).toBe("");
    expect(edge.handle.rect.width).toBe(1);
    expect(edge.handle.rect.height).toBe(LINE_LENGTH);
    expect(edge.handle.rect.x - fieldRight).toBeCloseTo(LINE_CLEARANCE, 1);
    expect(centreOf(edge.handle.rect).y).toBeCloseTo(centreOf(before.field).y, 1);

    const grip = centreOf(edge.band);
    await page.mouse.move(grip.x, grip.y);
    await page.mouse.down();
    await page.mouse.move(grip.x - 40, grip.y);
    await page.mouse.up();

    const after = await readResizeGeometry(horizontal);
    expect(after.root.width).toBeLessThan(before.root.width);

    const bothRoot = getTextareaRoot(page.getByRole("textbox", { name: BOTH_AXES }));
    await expect(
      bothRoot.getByRole("button", { name: "Resize textarea vertically" }),
    ).toBeVisible();
    await expect(
      bothRoot.getByRole("button", { name: "Resize textarea horizontally" }),
    ).toBeVisible();
  });

  test("centres a box handle on the border and leaves the corner between bands empty", async ({
    page,
  }) => {
    await page.goto("/ui/components/textarea");
    const geometry = await readResizeGeometry(page.getByRole("textbox", { name: BOTH_AXES }));
    const vertical = edgeOf(geometry, "vertical");
    const horizontal = edgeOf(geometry, "horizontal");
    const fieldBottom = geometry.field.y + geometry.field.height;
    const fieldRight = geometry.field.x + geometry.field.width;

    // A chip is the deliberate opposite of `line`: it is centred on the border,
    // half of it over the field, and the border runs unbroken behind it.
    expect(vertical.handle.kind).toBe("box-label");
    expect(vertical.handle.rect.height).toBe(CHIP);
    expect(centreOf(vertical.handle.rect).y).toBeCloseTo(fieldBottom, 1);

    expect(horizontal.handle.kind).toBe("box");
    expect(horizontal.handle.rect.width).toBe(CHIP);
    expect(centreOf(horizontal.handle.rect).x).toBeCloseTo(fieldRight, 1);

    // Each band stops where the other begins, so the corner belongs to neither and
    // a drag there can never be claimed by the wrong axis.
    expect(vertical.band.x + vertical.band.width).toBeCloseTo(fieldRight, 1);
    expect(horizontal.band.y + horizontal.band.height).toBeCloseTo(fieldBottom, 1);
    expect(intrusion(vertical.band, horizontal.band), "the shared corner").toBeLessThanOrEqual(
      EDGE_TOLERANCE,
    );
  });

  test("does not expose handles for fixed, read-only, or disabled fields", async ({ page }) => {
    await page.goto("/ui/components/textarea");

    for (const name of ["Fixed", "Read-only", "Disabled"]) {
      await expect(
        getTextareaRoot(page.getByRole("textbox", { name })).getByRole("button"),
      ).toHaveCount(0);
    }
  });

  test("keeps the final line reachable when content overflows", async ({ page }) => {
    await page.goto("/ui/components/textarea");
    const textarea = page.getByRole("textbox", { name: "Commit message" });

    const scroll = await textarea.evaluate((element) => {
      const control = element as HTMLTextAreaElement;
      control.value = Array.from({ length: 18 }, (_, index) => `line ${index + 1}`).join("\n");
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.scrollTop = control.scrollHeight;
      return {
        scrollTop: control.scrollTop,
        maxScrollTop: control.scrollHeight - control.clientHeight,
      };
    });

    // Scroll position was never the bug, and on its own it is a false negative:
    // it reads the same whether the last line is legible or sitting under a chip.
    // It is asserted only to establish that the field is parked on its final line.
    expect(
      scroll.maxScrollTop,
      "18 lines have to overflow, or this proves nothing",
    ).toBeGreaterThan(0);
    expect(scroll.scrollTop).toBe(scroll.maxScrollTop);

    const geometry = await readResizeGeometry(textarea);

    // The bug was covered pixels. With the default `line` handle nothing may reach
    // into the field at all — the border box, which is stricter than the content
    // box, because the field's own border is never broken either.
    for (const { rect, what } of chromeOf(geometry)) {
      expect(
        intrusion(geometry.field, rect),
        `${what} reaching into the field`,
      ).toBeLessThanOrEqual(EDGE_TOLERANCE);
    }

    // Then the same claim as a user makes it: click the final line and land in the
    // text. Anything painted over that strip answers the click instead. Every whole
    // pixel row the line occupies is probed, because chrome that clips the last row
    // or two is still chrome over the text.
    const finalLine = geometry.content.y + geometry.content.height;
    const columns = [0.1, 0.3, 0.5, 0.7, 0.9].map((fraction) =>
      Math.round(geometry.content.x + geometry.content.width * fraction),
    );
    const points: Point[] = [];
    for (
      let row = Math.ceil(finalLine - geometry.lineHeight);
      row <= Math.floor(finalLine);
      row += 1
    ) {
      for (const x of columns) points.push({ x, y: row });
    }
    const reaches = await reachAt(textarea, points);
    const covered = points.filter((_, index) => reaches[index] !== "field");
    expect(covered, "points on the final line that a click would not reach").toEqual([]);

    // The complement, which keeps the probe honest: the band immediately outside
    // the field does answer, so "field everywhere" above is a result, not a no-op.
    const grip = centreOf(edgeOf(geometry, "vertical").band);
    const [bandReach] = await reachAt(textarea, [{ x: Math.round(grip.x), y: Math.round(grip.y) }]);
    expect(bandReach, "the drag target sits just outside the field").toBe("resize-chrome");
  });
});
