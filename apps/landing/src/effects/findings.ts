import { type DemoFinding, demoFindings, formatFindingSummary } from "../demo";
import { el, severityChip } from "../dom";
import { type Cleanup, createEffectScope } from "../effect-scope";
import { sleep } from "../motion";
import { observeOnce } from "../observe";
import { type Flags, getFlags } from "../viewport";

const INTERACTIVE_TARGET =
  "a[href], button, input, textarea, select, [contenteditable]:not([contenteditable='false']), [tabindex]";

function createRow(finding: DemoFinding, index: number): HTMLButtonElement {
  const row = document.createElement("button");
  row.type = "button";
  row.id = `finding-tab-${index}`;
  row.className = "finding-row";
  row.setAttribute("role", "tab");
  row.setAttribute("aria-controls", "finding-detail");
  row.dataset.idx = String(index);
  row.dataset.hover = "";
  row.dataset.hoverProxy = ".sev";

  row.append(
    severityChip(finding),
    el("span", "title", finding.title),
    el("span", "loc", finding.location),
  );

  return row;
}

export function initFindings(
  root: ParentNode = document,
  flags: Flags = getFlags(),
  signal?: AbortSignal,
): Cleanup {
  const scope = createEffectScope(signal);
  if (!scope.active()) return scope.cleanup;

  const panel = root.querySelector<HTMLElement>("#findings-panel");
  const detail = root.querySelector<HTMLElement>("#finding-detail");
  const list = root.querySelector<HTMLElement>("#findings-list");
  const summary = root.querySelector<HTMLElement>("#findings-summary");
  if (!panel || !detail || !list) return scope.cleanup;

  list.textContent = "";
  list.setAttribute("aria-orientation", "vertical");
  const rows = demoFindings.map((finding, index) => createRow(finding, index));
  list.append(...rows);
  detail.setAttribute("role", "tabpanel");
  if (summary) summary.textContent = formatFindingSummary(demoFindings);

  const last = demoFindings.length - 1;
  let current = 0;
  const intro = new AbortController();
  scope.addCleanup(() => intro.abort());
  const isDisposed = (): boolean => !scope.active();

  function renderDetail(index: number): void {
    const d = demoFindings[index];
    if (!d || !detail) return;

    const meta = el("div", "fd-meta");
    meta.append(severityChip(d), el("span", "fd-tag", d.tag));

    const pre = document.createElement("pre");
    d.fix.forEach(([kind, line], i) => {
      if (i > 0) pre.append("\n");
      pre.append(el("span", kind, line));
    });

    const fix = el("div", "fd-fix");
    fix.append(el("div", "fix-label", "suggested fix"), pre);

    detail.replaceChildren(el("div", "fd-title", d.title), meta, el("p", "fd-body", d.body), fix);
    detail.setAttribute("aria-labelledby", `finding-tab-${index}`);
  }

  function highlight(index: number): void {
    if (isDisposed()) return;
    rows.forEach((row, i) => {
      const selected = i === index;
      row.toggleAttribute("data-highlighted", selected);
      row.setAttribute("aria-selected", String(selected));
      row.tabIndex = selected ? 0 : -1;
    });
    current = index;
    renderDetail(index);
  }

  function select(index: number): void {
    intro.abort();
    highlight(index);
  }

  highlight(0);
  for (const row of rows) {
    row.addEventListener("click", () => select(Number(row.dataset.idx)), {
      signal: scope.signal,
    });
    row.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key !== "ArrowDown" &&
          event.key !== "ArrowUp" &&
          event.key !== "Home" &&
          event.key !== "End"
        ) {
          return;
        }
        event.preventDefault();
        const next = (() => {
          if (event.key === "Home") return 0;
          if (event.key === "End") return last;
          return event.key === "ArrowDown" ? Math.min(last, current + 1) : Math.max(0, current - 1);
        })();
        select(next);
        rows[next]?.focus();
      },
      { signal: scope.signal },
    );
  }

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key !== "j" && event.key !== "k") return;
      const target = event.target;
      const withinWidget = target instanceof Element && panel.contains(target);
      if (!withinWidget && target instanceof Element && target.closest(INTERACTIVE_TARGET)) return;
      const rect = panel.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > innerHeight) return;
      const next = event.key === "j" ? Math.min(last, current + 1) : Math.max(0, current - 1);
      select(next);
      if (withinWidget) rows[next]?.focus();
      event.preventDefault();
    },
    { signal: scope.signal },
  );

  if (flags.reduced) return scope.cleanup;

  const cleanupObserver = observeOnce(
    panel,
    async () => {
      if (!(await sleep(800, intro.signal)) || isDisposed()) return;
      for (let i = 1; i <= 2; i++) {
        highlight(i);
        if (!(await sleep(850, intro.signal)) || isDisposed()) return;
      }
      if (!(await sleep(500, intro.signal)) || isDisposed()) return;
      highlight(0);
    },
    0.45,
  );
  scope.addCleanup(cleanupObserver);
  return scope.cleanup;
}
