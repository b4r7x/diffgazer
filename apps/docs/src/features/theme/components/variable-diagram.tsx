import { cn } from "@diffgazer/ui/lib/utils";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useTheme } from "@/hooks/theme-context";
import { THEME_DOCS_MAPPED_PRIMITIVES } from "../lib/token-presentation";

interface VariableDiagramProps {
  className?: string;
}

function buildDiagramDescription(theme: "dark" | "light"): string {
  return THEME_DOCS_MAPPED_PRIMITIVES.flatMap((primitive) =>
    primitive.semanticTokens[theme].map(
      (semanticToken) => `${primitive.name} feeds ${semanticToken}`,
    ),
  ).join("; ");
}

export function VariableDiagram({ className }: VariableDiagramProps) {
  const { theme } = useTheme();
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<
    Array<{ x1: number; y1: number; x2: number; y2: number; mapIndex: number; edgeIndex: number }>
  >([]);

  const primitiveRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const semanticRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // useEffectEvent (stable in React 19.2): the resize handler reads the latest
  // refs/state/active theme but must not re-subscribe the listener on every render.
  const computeLines = useEffectEvent(() => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    // The SVG is `inset-0` inside a 1px-bordered container, so its coordinate
    // origin is the padding box while getBoundingClientRect reports the border
    // box. clientLeft/clientTop are that border width.
    const originX = rect.left + container.clientLeft;
    const originY = rect.top + container.clientTop;
    const newLines: typeof lines = [];

    for (let i = 0; i < THEME_DOCS_MAPPED_PRIMITIVES.length; i++) {
      const primitive = THEME_DOCS_MAPPED_PRIMITIVES[i];
      const primEl = primitiveRefs.current.get(i);
      if (!primitive || !primEl) continue;

      const primRect = primEl.getBoundingClientRect();
      const x1 = primRect.right - originX;
      const y1 = primRect.top + primRect.height / 2 - originY;

      const edges = primitive.semanticTokens[theme];
      for (let j = 0; j < edges.length; j++) {
        const semEl = semanticRefs.current.get(`${i}-${j}`);
        if (!semEl) continue;

        const semRect = semEl.getBoundingClientRect();
        const x2 = semRect.left - originX;
        const y2 = semRect.top + semRect.height / 2 - originY;

        newLines.push({ x1, y1, x2, y2, mapIndex: i, edgeIndex: j });
      }
    }

    setLines(newLines);
  });

  // Recompute on mount, on resize, and whenever the active theme switches the
  // rendered primitive→semantic edges.
  // biome-ignore lint/correctness/useExhaustiveDependencies: computeLines is a useEffectEvent; theme is an intentional trigger that must re-run the line measurement when the rendered edges change.
  useEffect(() => {
    computeLines();

    // Each run forces ~38 synchronous layout reads, so a resize drag is
    // coalesced to one measurement per frame.
    let frame = 0;
    const scheduleCompute = () => {
      if (frame !== 0) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        computeLines();
      });
    };

    window.addEventListener("resize", scheduleCompute);
    return () => {
      window.removeEventListener("resize", scheduleCompute);
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, [theme]);

  return (
    <div
      ref={containerRef}
      className={cn("relative border border-border bg-background p-6", className)}
    >
      <p className="sr-only">{buildDiagramDescription(theme)}</p>
      <div className="flex justify-between gap-8">
        <div className="flex flex-col gap-2 shrink-0">
          <span className="text-2xs uppercase tracking-widest text-muted-foreground mb-1">
            Primitives ({theme})
          </span>
          {THEME_DOCS_MAPPED_PRIMITIVES.map((primitive, i) => (
            // biome-ignore lint/a11y/noStaticElementInteractions: hover only dims the unrelated rows; the mapping itself is read from the sr-only description above, so the row is not a control and must not enter the tab order.
            <div
              key={primitive.name}
              ref={(el) => {
                if (el) primitiveRefs.current.set(i, el);
              }}
              className={cn(
                "flex items-center gap-2 px-2 py-1 text-xs font-mono transition-opacity duration-150",
                highlighted !== null && highlighted !== i && "opacity-20",
              )}
              onMouseEnter={() => setHighlighted(i)}
              onMouseLeave={() => setHighlighted(null)}
            >
              <span
                className="w-3 h-3 shrink-0 border border-border"
                style={{ backgroundColor: `var(${primitive.name})` }}
              />
              <span className="text-foreground">{primitive.name}</span>
              <span className="text-muted-foreground">
                {primitive.darkValue} / {primitive.lightValue}
              </span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 shrink-0">
          <span className="text-2xs uppercase tracking-widest text-muted-foreground mb-1">
            Semantic Tokens
          </span>
          {THEME_DOCS_MAPPED_PRIMITIVES.map((primitive, i) =>
            primitive.semanticTokens[theme].map((semanticToken, j) => (
              // biome-ignore lint/a11y/noStaticElementInteractions: hover only dims the unrelated rows; the mapping itself is read from the sr-only description above, so the row is not a control and must not enter the tab order.
              <div
                key={semanticToken}
                ref={(el) => {
                  if (el) semanticRefs.current.set(`${i}-${j}`, el);
                }}
                className={cn(
                  "flex items-center gap-2 px-2 py-1 text-xs font-mono transition-opacity duration-150",
                  highlighted !== null && highlighted !== i && "opacity-20",
                )}
                onMouseEnter={() => setHighlighted(i)}
                onMouseLeave={() => setHighlighted(null)}
              >
                <span className="text-foreground">{semanticToken}</span>
              </div>
            )),
          )}
        </div>
      </div>

      <svg aria-hidden="true" className="absolute inset-0 w-full h-full pointer-events-none z-0">
        {lines.map((line) => (
          <path
            key={`${line.mapIndex}-${line.edgeIndex}`}
            d={`M ${line.x1} ${line.y1} C ${line.x1 + 40} ${line.y1}, ${line.x2 - 40} ${line.y2}, ${line.x2} ${line.y2}`}
            fill="none"
            stroke="var(--border)"
            strokeWidth={1}
            className="transition-opacity duration-150"
            style={{
              opacity: highlighted === null || highlighted === line.mapIndex ? 0.6 : 0.1,
            }}
          />
        ))}
      </svg>
    </div>
  );
}
