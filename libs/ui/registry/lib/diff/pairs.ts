import type { DiffChange } from "./parse.js";

export interface EditPairGroup {
  removes: DiffChange[];
  adds: DiffChange[];
}

export function* collectEditPairs(
  changes: DiffChange[],
): Generator<DiffChange | EditPairGroup> {
  let i = 0;
  while (i < changes.length) {
    if (changes[i].type === "context") {
      yield changes[i];
      i++;
      continue;
    }
    const removes: DiffChange[] = [];
    while (i < changes.length && changes[i].type === "remove")
      removes.push(changes[i++]);
    const adds: DiffChange[] = [];
    while (i < changes.length && changes[i].type === "add")
      adds.push(changes[i++]);
    yield { removes, adds };
  }
}
