import { type Cleanup, createEffectScope } from "./effect-scope";
import { initCopyButtons, initPackageManagerSwitch } from "./effects/copy";
import { initCursor } from "./effects/cursor";
import { createField } from "./effects/field";
import { initFindings } from "./effects/findings";
import { type GazeController, initGaze } from "./effects/gaze";
import { initHero } from "./effects/hero";
import { initHud } from "./effects/hud";
import { initPipeline } from "./effects/pipeline";
import { initTerminal } from "./effects/terminal";
import { wireEnvLinks } from "./env";
import { createMouse, type Flags, getFlags, isLight, type Mouse } from "./viewport";

function trackPointer(mouse: Mouse, signal: AbortSignal): void {
  addEventListener(
    "pointermove",
    (event) => {
      mouse.x = event.clientX;
      mouse.y = event.clientY;
      mouse.nx = event.clientX / innerWidth - 0.5;
      mouse.ny = event.clientY / innerHeight - 0.5;
      mouse.lastMove = performance.now();
    },
    { passive: true, signal },
  );
}

function startMotion(
  doc: Document,
  flags: Flags,
  gaze: GazeController,
  signal: AbortSignal,
): Cleanup {
  const mouse = createMouse();
  trackPointer(mouse, signal);

  const field = createField(doc, signal);
  const cursor = initCursor(doc, flags, mouse, signal);

  let running = true;
  let active = true;
  document.addEventListener(
    "visibilitychange",
    () => {
      running = !document.hidden;
    },
    { signal },
  );

  const loop = (now: number): void => {
    if (!active) return;
    if (running) {
      field?.draw(mouse, isLight(doc));
      gaze.tilt(now, mouse);
      cursor.draw();
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  return () => {
    active = false;
    field?.cleanup();
    cursor.cleanup();
  };
}

function startVisualEffects(doc: Document, flags: Flags, signal: AbortSignal): Cleanup {
  const scope = createEffectScope(signal);
  scope.addCleanup(initHud(doc, flags, scope.signal));
  scope.addCleanup(initHero(doc, flags, scope.signal));
  scope.addCleanup(initTerminal(doc, flags, scope.signal));
  const gaze = initGaze(doc, flags, scope.signal);
  scope.addCleanup(gaze.cleanup);
  // Callouts stay absolutely positioned against their anchor rows in both
  // branches, so re-anchoring on resize is not motion work.
  addEventListener("resize", () => gaze.placeCallouts(), { signal: scope.signal });
  scope.addCleanup(initFindings(doc, flags, scope.signal));
  scope.addCleanup(initPipeline(doc, flags, scope.signal));

  if (flags.reduced) {
    const field = createField(doc, scope.signal, { redrawOnResize: true });
    field?.draw(createMouse(), isLight(doc));
    scope.addCleanup(() => field?.cleanup());
  } else {
    scope.addCleanup(startMotion(doc, flags, gaze, scope.signal));
  }

  return scope.cleanup;
}

export function bootstrap(doc: Document = document, flags: Flags = getFlags()): Cleanup {
  const scope = createEffectScope();

  wireEnvLinks(doc);
  scope.addCleanup(initCopyButtons(doc, 1400, scope.signal));
  scope.addCleanup(initPackageManagerSwitch(doc, scope.signal));
  let activeFlags = flags;
  let stopVisualEffects = startVisualEffects(doc, activeFlags, scope.signal);
  scope.addCleanup(() => stopVisualEffects());

  if (typeof matchMedia === "function") {
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    const handleReducedMotionChange = (event: MediaQueryListEvent): void => {
      if (event.matches === activeFlags.reduced) return;
      stopVisualEffects();
      activeFlags = { ...activeFlags, reduced: event.matches };
      stopVisualEffects = startVisualEffects(doc, activeFlags, scope.signal);
    };
    reducedMotion.addEventListener("change", handleReducedMotionChange);
    scope.addCleanup(() => reducedMotion.removeEventListener("change", handleReducedMotionChange));
  }

  return scope.cleanup;
}
