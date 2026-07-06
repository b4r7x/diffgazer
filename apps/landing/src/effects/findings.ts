import { type DemoFinding, demoFindings, formatFindingSummary } from "../demo";
import { observeOnce } from "../observe";
import { type Cleanup, createEffectScope, type Flags, getFlags, sleep } from "../util";

const escapeHtml = (value: string): string => value.replace(/</g, "&lt;");

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

  const severity = document.createElement("span");
  severity.className = `sev sev-${finding.severity}`;
  severity.textContent = finding.severity;
  row.append(severity);

  const title = document.createElement("span");
  title.className = "title";
  title.textContent = finding.title;
  row.append(title);

  const location = document.createElement("span");
  location.className = "loc";
  location.textContent = finding.location;
  row.append(location);

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
  const isDisposed = (): boolean => !scope.active();

  function renderDetail(index: number): void {
    const d = demoFindings[index];
    if (!d || !detail) return;
    const fix = d.fix
      .map(([kind, line]) => `<span class="${kind}">${escapeHtml(line)}</span>`)
      .join("\n");
    detail.innerHTML = `
    <div class="fd-title">${d.title}</div>
    <div class="fd-meta"><span class="sev sev-${d.severity}">${d.severity}</span><span class="fd-tag">${d.tag}</span></div>
    <p class="fd-body">${d.body}</p>
    <div class="fd-fix"><div class="fix-label">suggested fix</div><pre>${fix}</pre></div>`;
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

  highlight(0);
  for (const row of rows) {
    row.addEventListener("click", () => highlight(Number(row.dataset.idx)), {
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
        highlight(next);
        rows[next]?.focus();
      },
      { signal: scope.signal },
    );
  }

  document.addEventListener(
    "keydown",
    (event) => {
      const target = event.target;
      if (target instanceof Element && target.closest("input, textarea")) return;
      const rect = panel.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > innerHeight) return;
      if (event.key === "j") highlight(Math.min(last, current + 1));
      else if (event.key === "k") highlight(Math.max(0, current - 1));
      else return;
      event.preventDefault();
    },
    { signal: scope.signal },
  );

  if (flags.reduced) return scope.cleanup;

  const cleanupObserver = observeOnce(
    panel,
    async () => {
      if (!(await sleep(800, scope.signal)) || isDisposed()) return;
      for (let i = 1; i <= 2; i++) {
        highlight(i);
        if (!(await sleep(850, scope.signal)) || isDisposed()) return;
      }
      if (!(await sleep(500, scope.signal)) || isDisposed()) return;
      highlight(0);
    },
    0.45,
  );
  scope.addCleanup(cleanupObserver);
  return scope.cleanup;
}
