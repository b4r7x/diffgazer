"use client";

import {
  type ComponentProps,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
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
  type ParsedDiff,
  parsedDiffIdentity,
  resolveDiffInput,
} from "@/lib/diff";
import { DiffViewSplit } from "./diff-view-split";
import { DiffViewUnified } from "./diff-view-unified";

/** Allowed diff view variant values. */
export type DiffViewVariant = "hairline" | "bare" | "dense" | "viewfinder" | "statusbar";

/** Allowed diff view density values. */
export type DiffViewDensity = "compact" | "default" | "comfortable";
/** Allowed diff view palette values. */
export type DiffViewPalette = "default" | "okabe-ito";

/** Props for diff view base. */
interface DiffViewBaseProps extends Omit<ComponentProps<"figure">, "children"> {
  /** Inline unified view or side-by-side split panes (Old / New). */
  mode?: "unified" | "split";
  /**
   * Renders line-number gutters. Surfaces as data-line-numbers on the rows container.
   * Defaults to true — findings are written as file:line, so the addressing scheme
   * ships on. variant="bare" defaults to false: a gutter is chrome.
   */
  showLineNumbers?: boolean;
  /** Disables intra-line word-level highlighting on added/removed rows. */
  disableWordDiff?: boolean;
  /**
   * Renders the `+adds −removes` readout at the end of the figcaption. On by
   * default; a diff with no add/remove changes renders nothing either way.
   */
  stat?: boolean;
  /**
   * Soft-wraps long code lines with a hanging indent instead of scrolling them
   * horizontally. Leave unset to let CSS own the default: containers under 40rem
   * and coarse pointers wrap, everything else keeps the filmstrip. Surfaces as
   * data-wrap="on" / "off" on the figure.
   */
  wrap?: boolean;
  /**
   * Fallback accessible name applied as aria-label when no native ARIA name or figcaption names the
   * figure (variant="bare" or a patch without paths).
   */
  label?: string;
  /**
   * Accessible name for the focusable inner rows region (the element screen-reader region
   * navigation lands on). Defaults to "Unified diff" in unified mode and "Split diff" in split
   * mode.
   */
  regionLabel?: string;
  /** Accessible name for the split-mode old side group. Defaults to "Old". */
  oldSideLabel?: string;
  /** Accessible name for the split-mode new side group. Defaults to "New". */
  newSideLabel?: string;
  /** Text for the role="status" empty state. Defaults to "No changes". */
  emptyLabel?: string;
  /** Screen-reader prefix for an added line. Defaults to "Added: ". */
  addedLineLabel?: string;
  /** Screen-reader prefix for a removed line. Defaults to "Removed: ". */
  removedLineLabel?: string;
  /**
   * Vertical density. Surfaces as data-density on the figure. Orthogonal to variant;
   * variant="dense" defaults this to "compact" unless overridden.
   */
  density?: DiffViewDensity;
  /**
   * Color palette for added/removed rows. "okabe-ito" overrides
   * --diff-color-add/--diff-color-remove with a colorblind-safe pair. Surfaces as
   * data-diff-palette on the figure.
   */
  palette?: DiffViewPalette;
  /**
   * CSS length applied to an opt-in vertical scroll wrapper. When set, the rows container gets
   * a fixed max-height and a y-axis scrollbar via the --diff-view-max-h CSS variable.
   */
  maxHeight?: string;
}

type DiffViewStatusbarVariantProps = {
  /**
   * Visual variant with a bottom statusBar slot. Fill statusBar with whatever your app needs
   * (diff stats, Kbd hints, actions). Omit statusBar to suppress the slot entirely.
   */
  variant: "statusbar";
  /** Optional content rendered in the bottom status bar slot. */
  statusBar?: ReactNode;
};

type DiffViewNonStatusbarVariantProps = {
  /**
   * Visual variant. "hairline" (default) is the dashboard-safe bordered look. "bare" removes
   * chrome and renders a 2px left rule; the figcaption is suppressed. "dense" tightens
   * typography and adds visible number-column dividers. "viewfinder" renders four bracketed
   * corners.
   */
  variant?: Exclude<DiffViewVariant, "statusbar">;
  statusBar?: never;
};

/** Props for diff view. */
export type DiffViewProps = (DiffInputPatch | DiffInputCompare | DiffInputParsed) &
  DiffViewBaseProps &
  (DiffViewStatusbarVariantProps | DiffViewNonStatusbarVariantProps);

// The public union keeps diff inputs mutually exclusive; this flattened shape
// lets the body destructure every key (including the diff discriminants) so the
// remaining `...rest` carries only genuine <figure> attributes to spread.
type DiffViewResolvedProps = DiffViewBaseProps &
  (DiffViewStatusbarVariantProps | DiffViewNonStatusbarVariantProps) & {
    patch?: string;
    before?: string;
    after?: string;
    diff?: ParsedDiff;
  };

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

function countChanges(parsed: ParsedDiff): { adds: number; removes: number } {
  let adds = 0;
  let removes = 0;
  for (const hunk of parsed.hunks) {
    for (const change of hunk.changes) {
      if (change.type === "add") adds += 1;
      else if (change.type === "remove") removes += 1;
    }
  }
  return { adds, removes };
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function getFileLabel(oldPath: string | null, newPath: string | null): string | null {
  if (!oldPath && !newPath) return null;
  if (oldPath && newPath && oldPath !== newPath) return `${oldPath} → ${newPath}`;
  return oldPath ?? newPath;
}

/** Root <figure> with aria-roledescription="diff". */
export function DiffView(props: DiffViewProps) {
  const {
    patch,
    before,
    after,
    diff,
    mode = "unified",
    showLineNumbers,
    disableWordDiff = false,
    stat = true,
    wrap,
    label,
    regionLabel,
    oldSideLabel = "Old",
    newSideLabel = "New",
    emptyLabel = "No changes",
    addedLineLabel = "Added: ",
    removedLineLabel = "Removed: ",
    className,
    style: styleProp,
    variant = "hairline",
    density,
    palette = "default",
    maxHeight,
    statusBar,
    ref,
    "aria-label": ariaLabelProp,
    "aria-labelledby": ariaLabelledByProp,
    "aria-roledescription": ariaRoleDescriptionProp,
    ...rest
  } = props as DiffViewResolvedProps;

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
      // Only consume Escape when it actually clears a hunk, so a bare Escape still
      // reaches an outer scope (e.g. the review-results back binding).
      if (activeHunk !== null) {
        e.preventDefault();
        e.stopPropagation();
        setActiveHunkState(null);
      }
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
  // Line numbers are the product's addressing scheme, so they ship on — except
  // under "bare", whose whole contract is no chrome.
  const resolvedLineNumbers = showLineNumbers ?? variant !== "bare";
  // Tri-state on purpose: absent leaves the responsive default to CSS.
  let wrapAttribute: "on" | "off" | undefined;
  if (wrap !== undefined) wrapAttribute = wrap ? "on" : "off";
  // O(lines) over data the renderer already walks — no state, no memo.
  const { adds, removes } = countChanges(parsed);
  const fileLabel = getFileLabel(parsed.oldPath, parsed.newPath);
  const showFigCaption = variant !== "bare" && fileLabel !== null;

  const captionId = useId();
  const ariaLabelledBy =
    ariaLabelledByProp ?? (ariaLabelProp === undefined && showFigCaption ? captionId : undefined);
  const ariaLabel = ariaLabelProp ?? (ariaLabelledBy ? undefined : (label ?? "Diff output"));

  const style =
    maxHeight || styleProp
      ? ({
          ...styleProp,
          ...(maxHeight ? { "--diff-view-max-h": maxHeight } : {}),
        } as CSSProperties)
      : undefined;

  const isDense = variant === "dense";
  const hasHunks = parsed.hunks.length > 0;

  let body: ReactNode = null;
  if (hasHunks && mode === "split") {
    body = (
      <DiffViewSplit
        parsed={parsed}
        showLineNumbers={resolvedLineNumbers}
        disableWordDiff={disableWordDiff}
        isDense={isDense}
        activeHunk={activeHunk}
        onKeyDown={onKeyDown}
        containerRef={containerRef}
        regionLabel={regionLabel}
        oldSideLabel={oldSideLabel}
        newSideLabel={newSideLabel}
        addedLineLabel={addedLineLabel}
        removedLineLabel={removedLineLabel}
      />
    );
  } else if (hasHunks) {
    body = (
      <DiffViewUnified
        parsed={parsed}
        showLineNumbers={resolvedLineNumbers}
        disableWordDiff={disableWordDiff}
        isDense={isDense}
        activeHunk={activeHunk}
        onKeyDown={onKeyDown}
        containerRef={containerRef}
        regionLabel={regionLabel}
        addedLineLabel={addedLineLabel}
        removedLineLabel={removedLineLabel}
      />
    );
  }

  return (
    <figure
      {...rest}
      ref={ref}
      data-slot="diff-view"
      data-variant={variant}
      data-density={resolvedDensity}
      data-diff-palette={palette}
      data-mode={mode}
      data-wrap={wrapAttribute}
      data-max-h={maxHeight ? "true" : undefined}
      aria-roledescription={ariaRoleDescriptionProp ?? "diff"}
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
          <span data-slot="diff-view-caption-path">{fileLabel}</span>
          {stat && adds + removes > 0 && (
            <span data-slot="diff-view-stat">
              {/* U+2212 MINUS, not a hyphen, so it optically matches the plus. */}
              <span className="diff-stat-add">+{adds}</span>
              <span className="diff-stat-remove">−{removes}</span>
              <span className="sr-only">
                {`${plural(adds, "addition")}, ${plural(removes, "deletion")}`}
              </span>
            </span>
          )}
        </figcaption>
      )}
      {/* biome-ignore lint/a11y/useSemanticElements: role="status" announces the empty diff state; <output> carries form-association semantics that do not fit here. */}
      <div
        data-slot="diff-view-empty"
        data-empty={hasHunks ? undefined : "true"}
        role="status"
        className={hasHunks ? "sr-only" : undefined}
      >
        {hasHunks ? "" : <span data-slot="diff-view-empty-label">{emptyLabel}</span>}
      </div>
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
