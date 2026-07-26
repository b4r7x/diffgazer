import type { DemoFinding } from "./demo";

/** An element with a class and, optionally, its text — the shape the effects build over and over. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text = "",
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

/** The severity chip shared by the gaze callouts, the findings list, and the pipeline rows. */
export function severityChip(finding: DemoFinding): HTMLSpanElement {
  return el("span", `sev sev-${finding.severity}`, finding.severity);
}
