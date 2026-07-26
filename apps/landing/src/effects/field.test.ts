import { afterEach, describe, expect, it, vi } from "vitest";
import { createMouse } from "../viewport";
import { createField } from "./field";

interface DrawnLine {
  alpha: number;
  y: number;
}

const drawn: DrawnLine[] = [];

function stubCanvasContext(): void {
  const context = {
    globalAlpha: 1,
    fillStyle: "",
    font: "",
    textBaseline: "",
    setTransform: () => {},
    clearRect: () => {},
    fillText: (_text: string, _x: number, y: number) => {
      drawn.push({ alpha: context.globalAlpha, y });
    },
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
}

/** Mounts the canvas plus one scene whose content box is `rect`. */
function mountScene(rect: { top: number; bottom: number }, sceneId = "s2"): void {
  document.body.innerHTML = `<canvas id="field"></canvas><section id="${sceneId}"><div class="scene-inner"></div></section>`;
  document.documentElement.dataset.osdScene = sceneId;
  const inner = document.querySelector(".scene-inner");
  if (!inner) throw new Error("scene inner missing");
  vi.spyOn(inner, "getBoundingClientRect").mockReturnValue({
    top: rect.top,
    bottom: rect.bottom,
    left: 0,
    right: 1200,
  } as DOMRect);
}

function drawOnce(options: { light: boolean; redrawOnResize?: boolean }): number {
  drawn.length = 0;
  const field = createField(document, undefined, {
    redrawOnResize: options.redrawOnResize ?? false,
  });
  if (!field) throw new Error("field did not start");
  field.draw(createMouse(), options.light);
  field.cleanup();
  const first = drawn[0];
  if (!first) throw new Error("nothing drawn");
  return first.alpha;
}

describe("ambient field content mask", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
    document.documentElement.removeAttribute("data-osd-scene");
  });

  function setup(rect: { top: number; bottom: number }, sceneId?: string): void {
    vi.stubGlobal("innerWidth", 1200);
    vi.stubGlobal("innerHeight", 900);
    // Deterministic seeding: every line lands on the same row and x.
    vi.spyOn(Math, "random").mockReturnValue(0);
    mountScene(rect, sceneId);
    stubCanvasContext();
  }

  it("dims lines that would print through the owning scene's content", () => {
    setup({ top: 40, bottom: 400 });

    // The ambient field is atmosphere, so over copy it drops well under the
    // strength at which its glyphs compete with the text.
    expect(drawOnce({ light: false })).toBeLessThanOrEqual(0.05);
  });

  it("keeps full presence where the field is only margin", () => {
    setup({ top: 600, bottom: 800 });

    expect(drawOnce({ light: false })).toBeCloseTo(0.13, 5);
  });

  it("stacks the mask with the light-scene factor", () => {
    setup({ top: 40, bottom: 400 });

    const dark = drawOnce({ light: false });
    const light = drawOnce({ light: true });

    expect(light).toBeLessThan(dark);
    expect(light).toBeLessThanOrEqual(0.03);
  });

  it("dims the hero exactly as much as any other owning scene", () => {
    setup({ top: 40, bottom: 400 });
    const other = drawOnce({ light: false });

    vi.restoreAllMocks();
    setup({ top: 40, bottom: 400 }, "s1");
    const hero = drawOnce({ light: false });

    // The hero is matched by the hero rule and by the owning-scene rule; only
    // one of them may pay, or the hero copy sits under a squared factor.
    expect(hero).toBeCloseTo(other, 5);
  });

  it("applies the same mask in the reduced-motion static branch", () => {
    setup({ top: 40, bottom: 400 });

    expect(drawOnce({ light: false, redrawOnResize: true })).toBeLessThanOrEqual(0.05);
  });
});
