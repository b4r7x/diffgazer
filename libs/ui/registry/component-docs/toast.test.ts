import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { toastDoc } from "./toast";

const compoundComponentsGuide = readFileSync(
  resolve(import.meta.dirname, "../../docs/content/patterns/compound-components.mdx"),
  "utf8",
);

describe("toastDoc", () => {
  it("documents that error toasts persist without duration and auto-dismiss with one, matching the compound-components guide", () => {
    const persistenceNote = toastDoc.notes?.find((note) => note.title === "Error Toasts Persist");
    const toneDescription = toastDoc.props?.["toast (function)"]?.tone?.description;
    const durationDescription = toastDoc.props?.["toast (function)"]?.duration?.description;

    expect(persistenceNote?.content).toContain("persist when duration is omitted");
    expect(persistenceNote?.content).toContain("explicit positive duration");
    expect(toneDescription).toContain("persist when duration is omitted");
    expect(durationDescription).toContain("explicit positive duration");
    expect(compoundComponentsGuide).toContain(
      "Error and loading toasts persist when `duration` is omitted.",
    );
    expect(compoundComponentsGuide).toContain(
      "A positive explicit duration schedules auto-dismissal.",
    );
  });

  it("documents localized dismiss and tone label props", () => {
    const toastProps = toastDoc.props?.["toast (function)"];
    expect(toastProps?.dismissLabel).toEqual({
      type: "string",
      required: false,
      defaultValue: '"Dismiss: " + title',
      description:
        "Accessible name for the dismiss button. The `hud` variant does not render a close button, so this prop has no effect there.",
    });
    expect(toastProps?.toneLabel).toEqual({
      type: "string",
      required: false,
      defaultValue: "the tone value",
      description:
        "Accessible tone label: screen-reader tone text announced before the toast title.",
    });
  });

  it("documents that the hud variant does not render a supplied action, so it never persists for one", () => {
    const durationDescription = toastDoc.props?.["toast (function)"]?.duration?.description;
    expect(durationDescription).toContain("rendered action");
    expect(durationDescription).toContain("`hud` variant does not render actions");
    expect(toastDoc.props?.["toast (function)"]?.action?.description).toContain("silently omits");
  });

  it("documents that hud omits the close button and auto-dismisses error and loading tones", () => {
    const persistenceNote = toastDoc.notes?.find((note) => note.title === "Error Toasts Persist");
    expect(persistenceNote?.content).toContain(
      "The `hud` variant omits the close button and auto-dismisses even for error and loading tones",
    );
    expect(persistenceNote?.content).toContain("non-finite duration (Infinity) to opt out");
    expect(toastDoc.props?.["toast (function)"]?.dismissLabel?.description).toContain(
      "does not render a close button",
    );
  });
});
