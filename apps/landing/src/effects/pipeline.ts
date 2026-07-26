import { formatFindingSummary, pipelineFindings } from "../demo";
import { el, severityChip } from "../dom";
import { type Cleanup, createEffectScope } from "../effect-scope";
import { clamp, spinAt } from "../motion";
import { type Flags, getFlags } from "../viewport";

const RP_TIMES = ["212ms", "1.2s", "8.4s", "0.9s"];
// Each step runs across [start, end) of the pinned-scroll progress; findings
// stream in while the review step (index 2) is active.
const RP_SPANS: [number, number][] = [
  [0.02, 0.2],
  [0.2, 0.38],
  [0.38, 0.74],
  [0.74, 0.9],
];
const RP_FIND_AT = [0.46, 0.56, 0.66];

type Phase = "queued" | "running" | "complete";

const PHASE_CLASS: Record<Phase, string> = { queued: "", running: "run", complete: "done" };
const PHASE_STATUS: Record<Phase, string> = {
  queued: "queued",
  running: "running",
  complete: "complete",
};
const PHASE_FOOT: Record<Phase, string> = {
  queued: "scroll to run the review",
  running: "streaming events…",
  complete: "review complete",
};

function phaseOf(progress: number): Phase {
  if (progress >= 0.92) return "complete";
  if (progress >= 0.02) return "running";
  return "queued";
}

function stepGlyph(run: boolean, done: boolean, spin: string): string {
  if (done) return "✓";
  if (run) return spin;
  return "○";
}

function phaseGlyph(phase: Phase, spin: string): string {
  if (phase === "complete") return "✓";
  if (phase === "running") return spin;
  return "○";
}

export function initPipeline(
  root: ParentNode = document,
  flags: Flags = getFlags(),
  signal?: AbortSignal,
): Cleanup {
  const scope = createEffectScope(signal);
  if (!scope.active()) return scope.cleanup;

  const wrap = root.querySelector<HTMLElement>("#s3-wrap");
  const steps = [...root.querySelectorAll<HTMLElement>(".rp-step")];
  const findingsWrap = root.querySelector<HTMLElement>("#rp-findings");
  const glyph = root.querySelector<HTMLElement>("#rp-glyph");
  const status = root.querySelector<HTMLElement>("#rp-status");
  const foot = root.querySelector<HTMLElement>("#rp-foot");
  const meta = root.querySelector<HTMLElement>("#rp-meta");
  if (!wrap || !findingsWrap || !glyph || !status || !foot || !meta) return scope.cleanup;

  findingsWrap.textContent = "";
  for (const finding of pipelineFindings) {
    const row = el("div", "rp-find");
    row.append(
      severityChip(finding),
      el("span", "ft", finding.title),
      el("span", "fl", finding.location),
    );
    findingsWrap.append(row);
  }
  const finds = [...findingsWrap.querySelectorAll<HTMLElement>(".rp-find")];

  const pinnable = () => innerWidth > 920 && !flags.reduced;

  const progress = (): number => {
    if (!pinnable()) return 1;
    const rect = wrap.getBoundingClientRect();
    return clamp(-rect.top / (rect.height - innerHeight), 0, 1);
  };

  // Scroll fires far more often than the pinned track advances: above and below it the
  // progress clamps to a constant, and at both ends the glyph is static rather than the
  // spinner, so an unchanged progress means an unchanged frame.
  let lastProgress: number | null = null;

  const scrub = (): void => {
    const p = progress();
    if (p === lastProgress) return;
    lastProgress = p;
    const spin = spinAt(Math.floor(performance.now() / 120));

    steps.forEach((step, i) => {
      const span = RP_SPANS[i];
      if (!span) return;
      const [a, b] = span;
      const run = p >= a && p < b;
      const done = p >= b;
      step.classList.toggle("run", run);
      step.classList.toggle("done", done);
      const g = step.querySelector<HTMLElement>(".g");
      if (g) g.textContent = stepGlyph(run, done, spin);
      const t = step.querySelector<HTMLElement>(".t");
      if (t) t.textContent = done ? (RP_TIMES[i] ?? "") : "";
    });

    finds.forEach((find, i) => {
      find.classList.toggle("on", p >= (RP_FIND_AT[i] ?? Number.POSITIVE_INFINITY));
    });

    const phase = phaseOf(p);
    glyph.textContent = phaseGlyph(phase, spin);
    glyph.className = PHASE_CLASS[phase];
    status.textContent = PHASE_STATUS[phase];
    foot.textContent = PHASE_FOOT[phase];
    meta.textContent =
      phase === "complete" ? `4 steps · ${formatFindingSummary(pipelineFindings)}` : "";
  };

  // Under reduced motion the scrub is pinned to the completed state, so the
  // only run it needs is the initial one.
  if (!flags.reduced) {
    addEventListener("scroll", scrub, { passive: true, signal: scope.signal });
    addEventListener("resize", scrub, { signal: scope.signal });
  }
  scrub();
  return scope.cleanup;
}
