import { demoFindings, formatFindingSummary, gazeFindings } from "../demo";
import { clamp, createEffectScope, lerp, type Mouse } from "../util";

type Kind = "ctx" | "hunk" | "add" | "rem";

interface Token {
  t: string;
  k: Kind;
}

interface Line {
  src: Token;
  z: number;
  row: number;
  x: number;
  speed: number;
}

const featuredFinding = gazeFindings[0];
const featuredFile = featuredFinding.location.replace(/:\d+$/, "");
const featuredRemoval =
  featuredFinding.fix.find(([kind]) => kind === "rem")?.[1] ?? "- return review.findings.length";
const featuredAddition =
  featuredFinding.fix.find(([kind]) => kind === "add")?.[1] ?? "+ return weightedTotal";

const FIELD_SRC = [
  { t: "$ diffgazer", k: "ctx" },
  { t: "→ Starting embedded server on http://127.0.0.1:3000", k: "ctx" },
  { t: `@@ -1,7 +1,10 @@ src/utils/${featuredFile}`, k: "hunk" },
  { t: "+    const weight = weights[finding.severity] ?? 1", k: "add" },
  { t: featuredRemoval, k: "rem" },
  {
    t: `▸ ${featuredFinding.severity.toUpperCase()}  ${featuredFinding.title}   ${featuredFinding.location}`,
    k: "ctx",
  },
  { t: featuredAddition, k: "add" },
  { t: "step_complete  review  8.4s", k: "ctx" },
  { t: 'import type { Review } from "../types"', k: "ctx" },
  { t: `✓ 4 steps · ${formatFindingSummary(demoFindings)}`, k: "ctx" },
] satisfies [Token, ...Token[]];

const LINE_H = 24;

const COLORS: Record<Kind, [dark: string, light: string]> = {
  add: ["#56d364", "#1a7f37"],
  rem: ["#ff7b72", "#cf222e"],
  hunk: ["#79b8ff", "#0969da"],
  ctx: ["#e5e5e5", "#1f2328"],
};

export interface Field {
  draw(mouse: Mouse, light: boolean): void;
  cleanup(): void;
}

const pick = <T>(items: [T, ...T[]]): T => items[(Math.random() * items.length) | 0] ?? items[0];

export function createField(root: ParentNode = document, signal?: AbortSignal): Field | null {
  const scope = createEffectScope(signal);
  if (!scope.active()) return null;

  const canvas = root.querySelector<HTMLCanvasElement>("#field");
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx) {
    scope.cleanup();
    return null;
  }

  let lines: Line[] = [];
  let fieldW = 0;
  let fieldH = 0;
  let camX = 0;
  let camY = 0;
  let scrollV = 0;
  let lastScrollY = scrollY;
  let apRect: DOMRect | null = null;
  let heroRect: DOMRect | null = null;

  function seedLine(line: Line, fresh: boolean): void {
    line.src = pick(FIELD_SRC);
    line.z = 0.9 + Math.random() * 1.6;
    const rows = (fieldH / LINE_H) | 0;
    line.row = 3 + ((Math.random() * Math.max(1, rows - 6)) | 0);
    line.x = fresh ? Math.random() * fieldW : fieldW + Math.random() * fieldW * 0.6;
    line.speed = (0.14 + Math.random() * 0.22) / line.z;
  }

  const resize = (): void => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    fieldW = innerWidth;
    fieldH = innerHeight;
    canvas.width = fieldW * dpr;
    canvas.height = fieldH * dpr;
    canvas.style.width = `${fieldW}px`;
    canvas.style.height = `${fieldH}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = innerWidth < 700 ? 8 : 16;
    lines = Array.from({ length: count }, () => {
      const line: Line = { src: FIELD_SRC[0], z: 1, row: 0, x: 0, speed: 0 };
      seedLine(line, true);
      return line;
    });
  };

  const cacheRects = (): void => {
    apRect = root.querySelector("#gaze3d")?.getBoundingClientRect() ?? null;
    heroRect = root.querySelector("#s1 .scene-inner")?.getBoundingClientRect() ?? null;
  };

  const draw = (mouse: Mouse, light: boolean): void => {
    if (!scope.active()) return;
    ctx.clearRect(0, 0, fieldW, fieldH);
    camX = lerp(camX, mouse.nx, 0.04);
    camY = lerp(camY, mouse.ny, 0.04);
    if (!apRect) cacheRects();
    const apVisible = !!apRect && apRect.bottom > 0 && apRect.top < fieldH;
    ctx.font = "13px Departure Mono, monospace";
    ctx.textBaseline = "middle";
    for (const line of lines) {
      line.x -= line.speed + clamp(scrollV * 0.05, -1.2, 1.2) / line.z;
      const w = line.src.t.length * 7.8;
      if (line.x < -w - 40) seedLine(line, false);
      const px = line.x + (camX * 14) / line.z;
      const py = line.row * LINE_H + (camY * 10) / line.z;
      let alpha = 0.15 / line.z;
      if (
        apVisible &&
        apRect &&
        py > apRect.top - 24 &&
        py < apRect.bottom + 24 &&
        px + w > apRect.left - 60 &&
        px < apRect.right + 60
      ) {
        alpha *= 0.15;
      }
      if (
        heroRect &&
        heroRect.bottom > 0 &&
        py > heroRect.top - 24 &&
        py < heroRect.bottom + 140 &&
        px + w > heroRect.left - 80 &&
        px < heroRect.right + 80
      ) {
        alpha *= 0.25;
      }
      if (light) alpha *= 0.55;
      ctx.globalAlpha = Math.min(0.13, alpha);
      ctx.fillStyle = COLORS[line.src.k][light ? 1 : 0];
      ctx.fillText(line.src.t, px, py);
    }
    ctx.globalAlpha = 1;
    scrollV = lerp(scrollV, 0, 0.06);
  };

  resize();
  let resizeTimer: ReturnType<typeof setTimeout> | undefined;
  addEventListener(
    "resize",
    () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 150);
    },
    { signal: scope.signal },
  );
  addEventListener("resize", cacheRects, { signal: scope.signal });
  addEventListener(
    "scroll",
    () => {
      scrollV = lerp(scrollV, scrollY - lastScrollY, 0.5);
      lastScrollY = scrollY;
      cacheRects();
    },
    { passive: true, signal: scope.signal },
  );

  scope.addCleanup(() => {
    if (resizeTimer) clearTimeout(resizeTimer);
  });

  return { draw, cleanup: scope.cleanup };
}
