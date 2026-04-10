import { useState, useRef, useEffect, useEffectEvent } from "react"
import { cn } from "@diffgazer/core/cn"

interface VariableMapping {
  primitive: { name: string; darkValue: string; lightValue: string }
  semantics: string[]
}

const VARIABLE_MAP: VariableMapping[] = [
  { primitive: { name: "--tui-bg", darkValue: "#0d1117", lightValue: "#ffffff" }, semantics: ["--background"] },
  { primitive: { name: "--tui-fg", darkValue: "#c9d1d9", lightValue: "#24292f" }, semantics: ["--foreground"] },
  { primitive: { name: "--tui-blue", darkValue: "#58a6ff", lightValue: "#0969da" }, semantics: ["--primary", "--accent", "--ring", "--info"] },
  { primitive: { name: "--tui-green", darkValue: "#3fb950", lightValue: "#1a7f37" }, semantics: ["--success"] },
  { primitive: { name: "--tui-red", darkValue: "#ff7b72", lightValue: "#cf222e" }, semantics: ["--destructive", "--error"] },
  { primitive: { name: "--tui-yellow", darkValue: "#d29922", lightValue: "#9a6700" }, semantics: ["--warning"] },
  { primitive: { name: "--tui-violet", darkValue: "#bc8cff", lightValue: "#8250df" }, semantics: [] },
  { primitive: { name: "--tui-border", darkValue: "#30363d", lightValue: "#d0d7de" }, semantics: ["--border"] },
  { primitive: { name: "--tui-muted", darkValue: "#6e7681", lightValue: "#57606a" }, semantics: ["--muted"] },
  { primitive: { name: "--tui-selection", darkValue: "#1f2428", lightValue: "#ddf4ff" }, semantics: ["--secondary", "--card", "--popover", "--input"] },
]

interface VariableDiagramProps {
  className?: string
}

export function VariableDiagram({ className }: VariableDiagramProps) {
  const [highlighted, setHighlighted] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [lines, setLines] = useState<Array<{ x1: number; y1: number; x2: number; y2: number; mapIndex: number }>>([])

  const primitiveRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const semanticRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const computeLines = useEffectEvent(() => {
    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const newLines: typeof lines = []

    for (let i = 0; i < VARIABLE_MAP.length; i++) {
      const primEl = primitiveRefs.current.get(i)
      if (!primEl) continue

      const primRect = primEl.getBoundingClientRect()
      const x1 = primRect.right - rect.left
      const y1 = primRect.top + primRect.height / 2 - rect.top

      for (let j = 0; j < VARIABLE_MAP[i].semantics.length; j++) {
        const semEl = semanticRefs.current.get(`${i}-${j}`)
        if (!semEl) continue

        const semRect = semEl.getBoundingClientRect()
        const x2 = semRect.left - rect.left
        const y2 = semRect.top + semRect.height / 2 - rect.top

        newLines.push({ x1, y1, x2, y2, mapIndex: i })
      }
    }

    setLines(newLines)
  })

  useEffect(() => {
    computeLines()
    window.addEventListener("resize", computeLines)
    return () => window.removeEventListener("resize", computeLines)
  }, [])

  return (
    <div ref={containerRef} className={cn("relative border border-border bg-background p-6", className)}>
      <div className="flex justify-between gap-8">
        <div className="flex flex-col gap-2 shrink-0">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Primitives</span>
          {VARIABLE_MAP.map((mapping, i) => (
            <div
              key={mapping.primitive.name}
              ref={(el) => { if (el) primitiveRefs.current.set(i, el) }}
              className={cn(
                "flex items-center gap-2 px-2 py-1 text-xs font-mono transition-opacity duration-150",
                highlighted !== null && highlighted !== i && "opacity-20",
              )}
              onMouseEnter={() => setHighlighted(i)}
              onMouseLeave={() => setHighlighted(null)}
            >
              <span
                className="w-3 h-3 shrink-0 border border-border"
                style={{ backgroundColor: `var(${mapping.primitive.name})` }}
              />
              <span className="text-foreground">{mapping.primitive.name}</span>
              <span className="text-muted-foreground">{mapping.primitive.darkValue}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 shrink-0">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Semantic Tokens</span>
          {VARIABLE_MAP.map((mapping, i) =>
            mapping.semantics.map((sem, j) => (
              <div
                key={sem}
                ref={(el) => { if (el) semanticRefs.current.set(`${i}-${j}`, el) }}
                className={cn(
                  "flex items-center gap-2 px-2 py-1 text-xs font-mono transition-opacity duration-150",
                  highlighted !== null && highlighted !== i && "opacity-20",
                )}
                onMouseEnter={() => setHighlighted(i)}
                onMouseLeave={() => setHighlighted(null)}
              >
                <span className="text-foreground">{sem}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
        {lines.map((line, i) => (
          <path
            key={i}
            d={`M ${line.x1} ${line.y1} C ${line.x1 + 40} ${line.y1}, ${line.x2 - 40} ${line.y2}, ${line.x2} ${line.y2}`}
            fill="none"
            stroke="var(--border)"
            strokeWidth={1}
            className="transition-opacity duration-150"
            style={{ opacity: highlighted === null || highlighted === line.mapIndex ? 0.6 : 0.1 }}
          />
        ))}
      </svg>
    </div>
  )
}
