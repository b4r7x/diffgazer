"use client";

import { useState } from "react";
import { useOverflowItems } from "@/hooks/use-overflow-items";
import { cn } from "@/lib/utils";

const TAGS = [
  "React",
  "TypeScript",
  "Next.js",
  "Tailwind",
  "Vite",
  "Vitest",
  "Zustand",
  "Prisma",
];

const TAG_COLORS = [
  "text-blue-400 border-blue-400/30",
  "text-green-400 border-green-400/30",
  "text-yellow-400 border-yellow-400/30",
  "text-pink-400 border-pink-400/30",
];

function Tag({ label, index }: { label: string; index: number }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center border px-1.5 py-0.5 font-mono text-[11px]",
        TAG_COLORS[index % TAG_COLORS.length]
      )}
    >
      {label}
    </span>
  );
}

function OverflowBadge({ count }: { count: number }) {
  return (
    <span className="inline-flex shrink-0 items-center border border-dashed border-foreground/30 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
      +{count}
    </span>
  );
}

export default function OverflowItemsBasicExample() {
  const [width, setWidth] = useState(300);

  const { ref, visibleCount, overflowCount } =
    useOverflowItems({ itemCount: TAGS.length });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <label htmlFor="oi-width-range" className="font-mono text-xs text-muted-foreground">width:</label>
        <input
          id="oi-width-range"
          type="range"
          min={120}
          max={500}
          value={width}
          onChange={(e) => setWidth(Number(e.target.value))}
          className="w-32"
        />
        <span className="font-mono text-xs">{width}px</span>
      </div>

      <div
        ref={ref}
        style={{ width }}
        className="relative flex items-center gap-2 overflow-clip border border-dashed border-foreground/20 p-2"
      >
        {TAGS.map((tag, i) => (
          <div key={tag} className={cn("shrink-0", i >= visibleCount && "invisible absolute pointer-events-none")}>
            <Tag label={tag} index={i} />
          </div>
        ))}
        <div className={cn("shrink-0", overflowCount === 0 && "invisible absolute pointer-events-none")}>
          <OverflowBadge count={Math.max(overflowCount, 1)} />
        </div>
      </div>

      <div className="flex gap-4 font-mono text-xs text-muted-foreground">
        <span>
          visible:{" "}
          <span className="text-green-400">{visibleCount}</span>
        </span>
        <span>
          overflow:{" "}
          <span className={overflowCount > 0 ? "text-red-400" : "text-muted-foreground"}>
            {overflowCount}
          </span>
        </span>
        <span>total: {TAGS.length}</span>
      </div>
    </div>
  );
}
