"use client";

import { cva } from "class-variance-authority";

/** Allowed spinner size values. */
export type SpinnerSize = "sm" | "md" | "lg";

// 3×3 grid positions (0–8, left-to-right top-to-bottom).
// Perimeter traversal order for clockwise snake movement:
//   0 1 2
//   3 · 5   ← center (4) is always invisible
//   6 7 8
const SNAKE_PERIMETER = [0, 1, 2, 5, 8, 7, 6, 3] as const;

export const SNAKE_FRAME_COUNT = SNAKE_PERIMETER.length;

const PERIMETER_POSITION = new Map<number, number>(SNAKE_PERIMETER.map((cell, i) => [cell, i]));
const TRAIL_OPACITIES = [1, 0.6, 0.3] as const;
const INACTIVE_OPACITY = 0.15;

/** Class variants for snake grid dot. */
export const snakeGridDotVariants = cva("rounded-sm bg-current", {
  variants: {
    size: {
      sm: "h-1 w-1",
      md: "h-1.5 w-1.5",
      lg: "h-2 w-2",
    },
  },
  defaultVariants: { size: "md" },
});

/** Class variants for snake grid container. */
export const snakeGridContainerVariants = cva("grid grid-cols-3", {
  variants: {
    size: {
      sm: "gap-[3px]",
      md: "gap-[3px]",
      lg: "gap-1",
    },
  },
  defaultVariants: { size: "md" },
});

const CELL_INDICES = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const;

function getCellOpacity(frame: number, cellIndex: number): number {
  const positionInPerimeter = PERIMETER_POSITION.get(cellIndex);
  if (positionInPerimeter === undefined) return 0;
  const distanceBehindHead =
    (frame - positionInPerimeter + SNAKE_PERIMETER.length) % SNAKE_PERIMETER.length;
  return TRAIL_OPACITIES[distanceBehindHead] ?? INACTIVE_OPACITY;
}

/** Props for snake grid. */
interface SnakeGridProps {
  /** Animation frame index. */
  frame: number;
  /** Font size token applied to the snake grid. */
  size: SpinnerSize;
}

export function SnakeGrid({ frame, size }: SnakeGridProps) {
  const dotClassName = snakeGridDotVariants({ size });

  return (
    <span className={snakeGridContainerVariants({ size })}>
      {CELL_INDICES.map((cellIndex) => (
        <span
          key={cellIndex}
          className={dotClassName}
          style={{ opacity: getCellOpacity(frame, cellIndex) }}
        />
      ))}
    </span>
  );
}
