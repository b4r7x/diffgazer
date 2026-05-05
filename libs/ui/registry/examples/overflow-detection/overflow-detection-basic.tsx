"use client";

import { useState } from "react"
import { useOverflow } from "@/hooks/use-overflow"

export default function OverflowDetectionBasicExample() {
  const [width, setWidth] = useState(200)
  const { ref, isOverflowing } = useOverflow<HTMLDivElement>()

  const text = "This text will overflow when the container is too narrow to fit it all."

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <label htmlFor="od-width-range" className="font-mono text-xs text-muted-foreground">width:</label>
        <input
          id="od-width-range"
          type="range"
          min={80}
          max={400}
          value={width}
          onChange={(e) => setWidth(Number(e.target.value))}
          className="w-32"
        />
        <span className="font-mono text-xs">{width}px</span>
      </div>

      <div
        style={{ width }}
        className="border border-dashed border-foreground/20 p-2"
      >
        <div ref={ref} className="truncate font-mono text-sm">
          {text}
        </div>
      </div>

      <span className="font-mono text-xs">
        isOverflowing:{" "}
        <span className={isOverflowing ? "text-red-400" : "text-green-400"}>
          {String(isOverflowing)}
        </span>
      </span>
    </div>
  )
}
