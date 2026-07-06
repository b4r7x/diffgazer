import { gazeFindings } from "../demo";
import { type Cleanup, type Flags, getFlags, type Mouse, sleep, spinAt } from "../util";

export interface GazeController {
  tilt(now: number, mouse: Mouse): void;
  placeCallouts(): void;
  cleanup: Cleanup;
}

const NOOP: GazeController = { tilt: () => {}, placeCallouts: () => {}, cleanup: () => {} };

function formatIssueCount(count: number): string {
  return `${count} ${count === 1 ? "issue" : "issues"}`;
}

function renderCallout(callout: HTMLElement, index: number): void {
  const finding = gazeFindings[index];
  if (!finding) return;
  callout.textContent = "";

  const line = document.createElement("div");
  line.className = "co-line1";

  const severity = document.createElement("span");
  severity.className = `sev sev-${finding.severity}`;
  severity.textContent = finding.severity;
  line.append(severity);

  const tag = document.createElement("span");
  tag.className = "fd-tag";
  tag.textContent = finding.tag;
  line.append(tag);

  const title = document.createElement("div");
  title.className = "co-title";
  title.textContent = finding.title;

  const location = document.createElement("div");
  location.className = "co-loc";
  location.textContent = finding.location;

  callout.append(line, title, location);
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
      node = node.offsetParent as HTMLElement | null;
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

  if (flags.reduced) {
    spin.textContent = "●";
    status.textContent = formatIssueCount(gazeFindings.length);
    for (const row of [...removed, ...added]) row.classList.add("lit");
    for (const callout of callouts) callout?.classList.add("on");
    return { tilt: () => {}, placeCallouts, cleanup: () => {} };
  }

  const spinTimer = setInterval(() => {
    spin.textContent = spinAt(Math.floor(performance.now() / 110));
  }, 110);

  let active = true;
  const stop = (): void => {
    active = false;
    clearInterval(spinTimer);
  };
  signal?.addEventListener("abort", stop, { once: true });
  const isActive = (): boolean => active && signal?.aborted !== true;
  if (signal?.aborted) stop();

  void (async () => {
    while (isActive()) {
      for (const row of rows) row.classList.remove("lit", "locked");
      for (const callout of callouts) callout?.classList.remove("on");
      status.textContent = "scanning";
      spin.style.color = "";
      if (!(await sleep(700, signal)) || !isActive()) break;

      scan.classList.add("visible");
      moveScan(rows.slice(1, 2));
      if (!(await sleep(750, signal)) || !isActive()) break;

      moveScan(removed);
      for (const row of removed) row.classList.add("lit");
      if (!(await sleep(800, signal)) || !isActive()) break;

      moveScan(added);
      for (const row of added) row.classList.add("lit");
      status.textContent = "analyzing";
      if (!(await sleep(950, signal)) || !isActive()) break;

      lockFinding(0, formatIssueCount(1));
      if (!(await sleep(2300, signal)) || !isActive()) break;

      lockFinding(1, formatIssueCount(gazeFindings.length));
      if (!(await sleep(2600, signal)) || !isActive()) break;

      scan.classList.remove("visible");
      status.textContent = "review complete";
      if (!(await sleep(2800, signal)) || !isActive()) break;
    }
  })();

  const tilt = (now: number, mouse: Mouse): void => {
    const sway = Math.sin(now * 0.0004) * 0.8;
    panel.style.setProperty("--gy", `${mouse.nx * 5 + sway}deg`);
    panel.style.setProperty("--gx", `${-mouse.ny * 3.5}deg`);
  };

  return {
    tilt,
    placeCallouts,
    cleanup: () => {
      signal?.removeEventListener("abort", stop);
      stop();
    },
  };
}
