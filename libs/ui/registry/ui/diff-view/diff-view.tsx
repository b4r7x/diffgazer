"use client";

import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  type RefObject,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigation } from "@/hooks/use-navigation";
import {
  type DiffInputCompare,
  type DiffInputParsed,
  type DiffInputPatch,
  parsedDiffIdentity,
  resolveDiffInput,
} from "@/lib/diff";
import { SplitView } from "./diff-view-split";
import { UnifiedView } from "./diff-view-unified";

export type DiffViewVariant = "hairline" | "bare" | "dense" | "viewfinder" | "statusbar";

export type DiffViewDensity = "compact" | "default" | "comfortable";
export type DiffViewPalette = "default" | "okabe-ito";

interface DiffViewBaseProps {
  mode?: "unified" | "split";
  showLineNumbers?: boolean;
  disableWordDiff?: boolean;
  label?: string;
  className?: string;
  variant?: DiffViewVariant;
  density?: DiffViewDensity;
  palette?: DiffViewPalette;
  maxHeight?: string;
  statusBar?: ReactNode;
  ref?: Ref<HTMLElement>;
}

export type DiffViewProps = (DiffInputPatch | DiffInputCompare | DiffInputParsed) &
  DiffViewBaseProps;

interface ActiveHunkState {
  parsedIdentity: string;
  value: string;
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

function getFileLabel(oldPath: string | null, newPath: string | null): string | null {
  if (!oldPath && !newPath) return null;
  if (oldPath && newPath && oldPath !== newPath) return `${oldPath} → ${newPath}`;
  return oldPath ?? newPath;
}

export function DiffView(props: DiffViewProps) {
  const {
    mode = "unified",
    showLineNumbers = false,
    disableWordDiff = false,
    label,
    className,
    variant = "hairline",
    density,
    palette = "default",
    maxHeight,
    statusBar,
    ref,
  } = props;

  const patch = "patch" in props ? props.patch : undefined;
  const before = "before" in props ? props.before : undefined;
  const after = "after" in props ? props.after : undefined;
  const diff = "diff" in props ? props.diff : undefined;
  const parsed = useMemo(() => {
    if (diff != null) return resolveDiffInput({ diff });
    if (patch != null) return resolveDiffInput({ patch });
    if (before != null && after != null) return resolveDiffInput({ before, after });
    return resolveDiffInput({ patch: "" });
  }, [patch, before, after, diff]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const parsedIdentity = useMemo(() => parsedDiffIdentity(parsed), [parsed]);
  const [activeHunkState, setActiveHunkState] = useState<ActiveHunkState | null>(null);
  const activeHunk = resolveActiveHunk(activeHunkState, parsedIdentity, parsed.hunks.length);

  const { onKeyDown: navKeyDown } = useNavigation({
    containerRef: containerRef as RefObject<HTMLElement | null>,
    role: "button",
    highlighted: activeHunk,
    onHighlightChange: (value) => {
      if (value !== null) setActiveHunkState({ parsedIdentity, value });
    },
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

  const resolvedDensity = density ?? (variant === "dense" ? "compact" : "default");
  const fileLabel = getFileLabel(parsed.oldPath, parsed.newPath);
  const showFigCaption = variant !== "bare" && fileLabel !== null;

  const captionId = useId();
  const ariaLabel = showFigCaption ? undefined : (label ?? "Diff output");
  const ariaLabelledBy = showFigCaption ? captionId : undefined;

  const style = maxHeight ? ({ "--dv-max-h": maxHeight } as CSSProperties) : undefined;

  const isDense = variant === "dense";
  const hasHunks = parsed.hunks.length > 0;

  const body = hasHunks ? (
    mode === "split" ? (
      <SplitView
        parsed={parsed}
        showLineNumbers={showLineNumbers}
        disableWordDiff={disableWordDiff}
        isDense={isDense}
        activeHunk={activeHunk}
        onKeyDown={onKeyDown}
        containerRef={containerRef}
      />
    ) : (
      <UnifiedView
        parsed={parsed}
        showLineNumbers={showLineNumbers}
        disableWordDiff={disableWordDiff}
        isDense={isDense}
        activeHunk={activeHunk}
        onKeyDown={onKeyDown}
        containerRef={containerRef}
      />
    )
  ) : (
    // biome-ignore lint/a11y/useSemanticElements: role="status" announces the empty diff state; <output> carries form-association semantics that do not fit here.
    <div data-slot="diff-view-empty" role="status">
      No changes
    </div>
  );

  return (
    <figure
      ref={ref}
      data-slot="diff-view"
      data-variant={variant}
      data-density={resolvedDensity}
      data-diff-palette={palette}
      data-mode={mode}
      data-max-h={maxHeight ? "true" : undefined}
      aria-roledescription="diff"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={className}
      style={style}
    >
      {variant === "viewfinder" && (
        <span aria-hidden="true" data-slot="diff-view-corners">
          <span className="vf-tl" />
          <span className="vf-tr" />
          <span className="vf-bl" />
          <span className="vf-br" />
        </span>
      )}
      {showFigCaption && (
        <figcaption id={captionId} data-slot="diff-view-caption">
          {fileLabel}
        </figcaption>
      )}
      {hasHunks && maxHeight ? (
        <div data-slot="diff-view-scroll-v" className="scrollbar-thin">
          {body}
        </div>
      ) : (
        body
      )}
      {variant === "statusbar" && statusBar != null && (
        <div data-slot="diff-view-statusbar">{statusBar}</div>
      )}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </figure>
  );
}
