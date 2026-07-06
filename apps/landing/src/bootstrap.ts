import { initCopyButtons } from "./effects/copy";
import { initCursor } from "./effects/cursor";
import { createField } from "./effects/field";
import { initFindings } from "./effects/findings";
import { type GazeController, initGaze } from "./effects/gaze";
import { initHero } from "./effects/hero";
import { initHud } from "./effects/hud";
import { initPipeline } from "./effects/pipeline";
import { initTerminal } from "./effects/terminal";
import { wireEnvLinks } from "./env";
import { type Cleanup, createMouse, type Flags, getFlags, isLight, type Mouse } from "./util";

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

  addEventListener("resize", () => gaze.placeCallouts(), { signal });

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

export function bootstrap(doc: Document = document, flags: Flags = getFlags()): Cleanup {
  const controller = new AbortController();
  const cleanups: Cleanup[] = [];
  const addCleanup = (cleanup: Cleanup | undefined): void => {
    if (cleanup) cleanups.push(cleanup);
  };
  const cleanup = (): void => {
    controller.abort();
    for (const dispose of cleanups.splice(0)) dispose();
  };

  wireEnvLinks(doc);
  addCleanup(initHud(doc, flags, controller.signal));
  addCleanup(initCopyButtons(doc, 1400, controller.signal));
  addCleanup(initHero(doc, flags, controller.signal));
  addCleanup(initTerminal(doc, flags, controller.signal));
  const gaze = initGaze(doc, flags, controller.signal);
  addCleanup(gaze.cleanup);
  addCleanup(initFindings(doc, flags, controller.signal));
  addCleanup(initPipeline(doc, flags, controller.signal));

  if (flags.reduced) {
    const field = createField(doc, controller.signal);
    field?.draw(createMouse(), isLight(doc));
    addCleanup(() => field?.cleanup());
    return cleanup;
  }

  addCleanup(startMotion(doc, flags, gaze, controller.signal));
  return cleanup;
}
