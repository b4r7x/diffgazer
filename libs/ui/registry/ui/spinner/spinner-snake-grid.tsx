"use client";

import { cn } from "@/lib/utils";
import type { SpinnerSize } from "./spinner";

// 3×3 grid positions (0–8, left-to-right top-to-bottom).
// Perimeter traversal order for clockwise snake movement:
//   0 1 2
//   3 · 5   ← center (4) is always invisible
//   6 7 8
const SNAKE_PERIMETER = [0, 1, 2, 5, 8, 7, 6, 3] as const;
const SNAKE_TAIL_LENGTH = 3;

export const SNAKE_FRAME_COUNT = SNAKE_PERIMETER.length;

const PERIMETER_POSITION = new Map<number, number>(SNAKE_PERIMETER.map((cell, i) => [cell, i]));
const TRAIL_OPACITIES = [1, 0.6, 0.3] as const;
const INACTIVE_OPACITY = 0.15;

const DOT_SIZES: Record<SpinnerSize, { dot: string; gap: string }> = {
  sm: { dot: "h-1 w-1", gap: "gap-[3px]" },
  md: { dot: "h-1.5 w-1.5", gap: "gap-[3px]" },
  lg: { dot: "h-2 w-2", gap: "gap-1" },
};

const CELL_INDICES = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const;

function getCellOpacity(frame: number, cellIndex: number): number {
  const positionInPerimeter = PERIMETER_POSITION.get(cellIndex);
  if (positionInPerimeter === undefined) return 0;
  const distanceBehindHead = (frame - positionInPerimeter + SNAKE_PERIMETER.length) % SNAKE_PERIMETER.length;
  return distanceBehindHead < SNAKE_TAIL_LENGTH ? TRAIL_OPACITIES[distanceBehindHead] : INACTIVE_OPACITY;
}

interface SnakeGridProps {
  frame: number;
  size: SpinnerSize;
}

export function SnakeGrid({ frame, size }: SnakeGridProps) {
  const { dot, gap } = DOT_SIZES[size];
  const dotClassName = cn("rounded-sm bg-current", dot);

  return (
    <span className={cn("grid grid-cols-3", gap)}>
      {CELL_INDICES.map(cellIndex => (
        <span
          key={cellIndex}
          className={dotClassName}
          style={{ opacity: getCellOpacity(frame, cellIndex) }}
        />
      ))}
    </span>
  );
}
