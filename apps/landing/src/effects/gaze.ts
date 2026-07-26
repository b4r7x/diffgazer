import { gazeFindings } from "../demo";
import { el, severityChip } from "../dom";
import { type Cleanup, createEffectScope } from "../effect-scope";
import { sleep, spinAt } from "../motion";
import { type Flags, getFlags, type Mouse } from "../viewport";

export interface GazeController {
  tilt(now: number, mouse: Mouse): void;
  placeCallouts(): void;
  cleanup: Cleanup;
}

const NOOP: GazeController = { tilt: () => {}, placeCallouts: () => {}, cleanup: () => {} };

/**
 * Below this width the hero diff clips its lines to an ellipsis instead of
 * scrolling (see the matching `max-width: 700px` block in styles/index.css), so
 * the rows are no longer a scroll container and the authored tab stop would be a
 * focusable element with nothing to operate. Landing has no framework to derive
 * markup from state, so the attribute pair is driven off the same media query
 * the stylesheet uses; the two have to move together.
 */
const CLIPPED_DIFF_QUERY = "(max-width: 700px)";

/** Keep the diff rows in the tab order only while they are really scrollable. */
function trackDiffScroller(diff: HTMLElement): Cleanup {
  if (typeof matchMedia !== "function") return () => {};
  const label = diff.getAttribute("aria-label") ?? "";
  const clipped = matchMedia(CLIPPED_DIFF_QUERY);
  const apply = (): void => {
    if (clipped.matches) {
      diff.removeAttribute("tabindex");
      diff.removeAttribute("aria-label");
    } else {
      diff.tabIndex = 0;
      diff.setAttribute("aria-label", label);
    }
  };
  apply();
  clipped.addEventListener("change", apply);
  // Restore the authored markup so a re-init (a motion-preference flip restarts
  // every effect) reads the real label back rather than an emptied attribute.
  return () => {
    clipped.removeEventListener("change", apply);
    diff.tabIndex = 0;
    diff.setAttribute("aria-label", label);
  };
}

function formatIssueCount(count: number): string {
  return `${count} ${count === 1 ? "issue" : "issues"}`;
}

function renderCallout(callout: HTMLElement, index: number): void {
  const finding = gazeFindings[index];
  if (!finding) return;

  const line = el("div", "co-line1");
  line.append(severityChip(finding), el("span", "fd-tag", finding.tag));

  callout.replaceChildren(
    line,
    el("div", "co-title", finding.title),
    el("div", "co-loc", finding.location),
  );
}

export function initGaze(
  root: ParentNode = document,
  flags: Flags = getFlags(),
  signal?: AbortSignal,
): GazeController {
  const panel = root.querySelector<HTMLElement>("#gaze3d");
  const diff = root.querySelector<HTMLElement>("#gz-diff");
  const scan = root.querySelector<HTMLElement>("#gz-scan");
  const spin = root.querySelector<HTMLElement>("#gz-spin");
  const status = root.querySelector<HTMLElement>("#gz-status");
  if (!panel || !diff || !scan || !spin || !status) return NOOP;

  const stage = panel.parentElement;
  const rows = [...diff.querySelectorAll<HTMLElement>("[data-row]")];
  const removed = rows.filter((row) => row.dataset.state === "removed");
  const added = rows.filter((row) => row.dataset.state === "added");
  const callouts = [
    root.querySelector<HTMLElement>("#gz-co-0"),
    root.querySelector<HTMLElement>("#gz-co-1"),
  ];
  callouts.forEach((callout, index) => {
    if (callout) renderCallout(callout, index);
  });
  const target = (i: number) => diff.querySelector<HTMLElement>(`[data-target="${i}"]`);

  // Cumulative offsetTop up the offsetParent chain, so a callout anchored to a
  // row lands correctly through the Panel → DiffView nesting.
  const offsetTopWithin = (el: HTMLElement, ancestor: Element | null): number => {
    let top = 0;
    let node: HTMLElement | null = el;
    while (node && node !== ancestor) {
      top += node.offsetTop;
      const parent: Element | null = node.offsetParent;
      node = parent instanceof HTMLElement ? parent : null;
    }
    return top;
  };

  const placeCallouts = (): void => {
    for (const i of [0, 1]) {
      const anchor = target(i);
      const callout = callouts[i];
      if (anchor && callout) {
        callout.style.top = `${offsetTopWithin(anchor, stage) - 2}px`;
      }
    }
  };

  const moveScan = (band: HTMLElement[]): void => {
    const first = band[0];
    const last = band[band.length - 1];
    if (!first || !last) return;
    const top = first.offsetTop;
    scan.style.transform = `translateY(${top}px)`;
    scan.style.height = `${last.offsetTop + last.offsetHeight - top}px`;
  };

  const lockFinding = (i: number, label: string): void => {
    const anchor = target(i);
    if (!anchor) return;
    moveScan([anchor]);
    anchor.classList.add("locked");
    status.textContent = label;
    callouts[i]?.classList.add("on");
  };

  placeCallouts();
  const stopDiffScroller = trackDiffScroller(diff);

  // A motion-preference flip re-runs this init over a DOM the other branch may
  // have left mid-scan, so drop animated state before taking either path.
  scan.classList.remove("visible");
  for (const row of rows) row.classList.remove("lit", "locked");
  for (const callout of callouts) callout?.classList.remove("on");

  if (flags.reduced) {
    spin.textContent = "●";
    status.textContent = formatIssueCount(gazeFindings.length);
    for (const row of [...removed, ...added]) row.classList.add("lit");
    for (const callout of callouts) callout?.classList.add("on");
    return { tilt: () => {}, placeCallouts, cleanup: stopDiffScroller };
  }

  const scope = createEffectScope(signal);
  scope.addCleanup(stopDiffScroller);
  const spinTimer = setInterval(() => {
    spin.textContent = spinAt(Math.floor(performance.now() / 110));
  }, 110);
  scope.addCleanup(() => clearInterval(spinTimer));
  const isActive = scope.active;

  void (async () => {
    while (isActive()) {
      for (const row of rows) row.classList.remove("lit", "locked");
      for (const callout of callouts) callout?.classList.remove("on");
      status.textContent = "scanning";
      spin.style.color = "";
      if (!(await sleep(700, scope.signal)) || !isActive()) break;

      scan.classList.add("visible");
      moveScan(rows.slice(1, 2));
      if (!(await sleep(750, scope.signal)) || !isActive()) break;

      moveScan(removed);
      for (const row of removed) row.classList.add("lit");
      if (!(await sleep(800, scope.signal)) || !isActive()) break;

      moveScan(added);
      for (const row of added) row.classList.add("lit");
      status.textContent = "analyzing";
      if (!(await sleep(950, scope.signal)) || !isActive()) break;

      lockFinding(0, formatIssueCount(1));
      if (!(await sleep(2300, scope.signal)) || !isActive()) break;

      lockFinding(1, formatIssueCount(gazeFindings.length));
      if (!(await sleep(2600, scope.signal)) || !isActive()) break;

      scan.classList.remove("visible");
      status.textContent = "review complete";
      if (!(await sleep(2800, scope.signal)) || !isActive()) break;
    }
  })();

  const tilt = (now: number, mouse: Mouse): void => {
    const sway = Math.sin(now * 0.0004) * 0.8;
    panel.style.setProperty("--gy", `${mouse.nx * 5 + sway}deg`);
    panel.style.setProperty("--gx", `${-mouse.ny * 3.5}deg`);
  };

  return { tilt, placeCallouts, cleanup: scope.cleanup };
}
