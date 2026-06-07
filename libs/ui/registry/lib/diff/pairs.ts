import type { DiffChange } from "./parse";

export interface EditPairGroup {
  removes: DiffChange[];
  adds: DiffChange[];
}

export function* collectEditPairs(changes: DiffChange[]): Generator<DiffChange | EditPairGroup> {
  let i = 0;
  while (i < changes.length) {
    const head = changes[i];
    if (!head) {
      i++;
      continue;
    }
    if (head.type === "context") {
      yield head;
      i++;
      continue;
    }
    const removes: DiffChange[] = [];
    while (i < changes.length) {
      const next = changes[i];
      if (!next || next.type !== "remove") break;
      removes.push(next);
      i++;
    }
    const adds: DiffChange[] = [];
    while (i < changes.length) {
      const next = changes[i];
      if (!next || next.type !== "add") break;
      adds.push(next);
      i++;
    }
    yield { removes, adds };
  }
}
