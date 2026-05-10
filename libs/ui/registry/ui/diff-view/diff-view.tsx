"use client";

import {
  useState,
  useRef,
  useMemo,
  type Ref,
  type RefObject,
  type KeyboardEvent,
} from "react";
import { cn } from "@/lib/utils";
import {
  type ParsedDiff,
  type DiffInputPatch,
  type DiffInputCompare,
  type DiffInputParsed,
  resolveDiffInput,
} from "@/lib/diff";
import { useNavigation } from "@/hooks/use-navigation";
import { Kbd } from "../kbd/kbd.js";
import { UnifiedView } from "./diff-view-unified.js";
import { SplitView } from "./diff-view-split.js";

interface DiffViewBaseProps {
  mode?: "unified" | "split";
  showLineNumbers?: boolean;
  disableWordDiff?: boolean;
  label?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

export type DiffViewProps = (
  | DiffInputPatch
  | DiffInputCompare
  | DiffInputParsed
) &
  DiffViewBaseProps;

interface ActiveHunkState {
  parsedIdentity: string;
  value: string;
}

function getParsedDiffIdentity(parsed: ParsedDiff): string {
  return JSON.stringify([
    parsed.oldPath,
    parsed.newPath,
    parsed.hunks.map((hunk) => [
      hunk.oldStart,
      hunk.oldCount,
      hunk.newStart,
      hunk.newCount,
      hunk.heading,
      hunk.changes.map((change) => [
        change.type,
        change.content,
        change.oldLine,
        change.newLine,
      ]),
    ]),
  ]);
}

function resolveActiveHunk(
  activeHunkState: ActiveHunkState | null,
  parsedIdentity: string,
  hunkCount: number,
): string | null {
  if (activeHunkState?.parsedIdentity !== parsedIdentity) return null;

  const activeIndex = Number(activeHunkState.value);
  if (!Number.isInteger(activeIndex) || activeIndex < 0 || activeIndex >= hunkCount) {
    return null;
  }

  return activeHunkState.value;
}

function FileHeader({
  oldPath,
  newPath,
}: {
  oldPath: string | null;
  newPath: string | null;
}) {
  if (!oldPath && !newPath) return null;

  const label =
    oldPath && newPath && oldPath !== newPath
      ? `${oldPath} → ${newPath}`
      : (oldPath ?? newPath);

  return (
    <div className="px-2 py-1 bg-muted/50 border-b border-border text-muted-foreground truncate">
      {label}
    </div>
  );
}

function DiffContent({
  parsed,
  mode,
  showLineNumbers,
  disableWordDiff,
  activeHunk,
  onKeyDown,
  containerRef,
}: {
  parsed: ParsedDiff;
  mode: "unified" | "split";
  showLineNumbers: boolean;
  disableWordDiff: boolean;
  activeHunk: string | null;
  onKeyDown: (e: KeyboardEvent) => void;
  containerRef: RefObject<HTMLElement | null>;
}) {
  if (parsed.hunks.length === 0) {
    return (
      <div
        className="p-4 text-center text-muted-foreground text-sm"
        role="status"
      >
        No changes
      </div>
    );
  }
  if (mode === "split") {
    return (
      <SplitView
        parsed={parsed}
        showLineNumbers={showLineNumbers}
        disableWordDiff={disableWordDiff}
        activeHunk={activeHunk}
        onKeyDown={onKeyDown}
        containerRef={containerRef}
      />
    );
  }
  return (
    <UnifiedView
      parsed={parsed}
      showLineNumbers={showLineNumbers}
      disableWordDiff={disableWordDiff}
      activeHunk={activeHunk}
      onKeyDown={onKeyDown}
      containerRef={containerRef}
    />
  );
}

export function DiffView(props: DiffViewProps) {
  const {
    mode = "unified",
    showLineNumbers = false,
    disableWordDiff = false,
    label,
    className,
    ref,
  } = props;
  const patch = "patch" in props ? props.patch : undefined;
  const before = "before" in props ? props.before : undefined;
  const after = "after" in props ? props.after : undefined;
  const diff = "diff" in props ? props.diff : undefined;
  const parsed = useMemo(
    () => resolveDiffInput(props),
    [patch, before, after, diff],
  );
  const containerRef = useRef<HTMLElement | null>(null);
  const parsedIdentity = useMemo(() => getParsedDiffIdentity(parsed), [parsed]);
  const [activeHunkState, setActiveHunkState] = useState<ActiveHunkState | null>(null);
  const activeHunk = resolveActiveHunk(activeHunkState, parsedIdentity, parsed.hunks.length);

  const { onKeyDown: navKeyDown } = useNavigation({
    containerRef,
    role: "button",
    highlighted: activeHunk,
    onHighlightChange: (value) => setActiveHunkState({ parsedIdentity, value }),
    upKeys: ["k"],
    downKeys: ["j"],
    wrap: false,
    moveFocus: false,
  });

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setActiveHunkState(null);
      return;
    }
    navKeyDown(e);
  };

  const activeIndex = activeHunk != null ? Number(activeHunk) : null;
  const activeHunkData = activeIndex != null ? parsed.hunks[activeIndex] : undefined;
  const announcement =
    activeIndex != null && activeHunkData
      ? `Hunk ${activeIndex + 1} of ${parsed.hunks.length}${activeHunkData.heading ? `: ${activeHunkData.heading}` : ""}`
      : "";

  return (
    <div
      ref={ref}
      role="region"
      aria-roledescription="diff"
      aria-label={label ?? "Diff output"}
      className={cn(
        "group bg-background border border-border font-mono text-xs",
        className,
      )}
    >
      <FileHeader oldPath={parsed.oldPath} newPath={parsed.newPath} />
      {parsed.hunks.length > 0 && (
        <div className="hidden group-focus-within:flex items-center gap-1 px-2 py-0.5 text-[10px] text-muted-foreground border-b border-border">
          <Kbd size="sm">j</Kbd>
          <Kbd size="sm">k</Kbd>
          <span>navigate hunks</span>
        </div>
      )}
      <DiffContent
        parsed={parsed}
        mode={mode}
        showLineNumbers={showLineNumbers}
        disableWordDiff={disableWordDiff}
        activeHunk={activeHunk}
        onKeyDown={onKeyDown}
        containerRef={containerRef}
      />
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </div>
  );
}
