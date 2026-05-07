import { useState, useRef, useEffect, useEffectEvent } from "react"
import { cn } from "@diffgazer/core/cn"

interface VariableMapping {
  primitive: { name: string; darkValue: string; lightValue: string }
  semantics: string[]
}

const VARIABLE_MAP: VariableMapping[] = [
  { primitive: { name: "--tui-bg", darkValue: "#0a0a0a", lightValue: "#ffffff" }, semantics: ["--background"] },
  { primitive: { name: "--tui-fg", darkValue: "#e5e5e5", lightValue: "#1a1a1a" }, semantics: ["--foreground", "--primary", "--ring"] },
  { primitive: { name: "--tui-blue", darkValue: "#ccccff", lightValue: "#4444cc" }, semantics: ["--info"] },
  { primitive: { name: "--tui-green", darkValue: "#e5e5e5", lightValue: "#1a1a1a" }, semantics: ["--success"] },
  { primitive: { name: "--tui-red", darkValue: "#ff7b72", lightValue: "#cf222e" }, semantics: ["--destructive", "--error"] },
  { primitive: { name: "--tui-yellow", darkValue: "#d29922", lightValue: "#9a6700" }, semantics: ["--warning"] },
  { primitive: { name: "--tui-violet", darkValue: "#787878", lightValue: "#767676" }, semantics: [] },
  { primitive: { name: "--tui-border", darkValue: "#606060", lightValue: "#888888" }, semantics: ["--border"] },
  { primitive: { name: "--tui-muted", darkValue: "#787878", lightValue: "#767676" }, semantics: ["--muted"] },
  { primitive: { name: "--tui-highlight", darkValue: "#ffffff", lightValue: "#000000" }, semantics: ["--accent", "--action"] },
  { primitive: { name: "--tui-selection", darkValue: "#333333", lightValue: "#f0f0f0" }, semantics: ["--secondary", "--card", "--popover", "--input"] },
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
