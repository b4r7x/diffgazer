"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

const actions = ["Review", "Rerun", "Discard"] as const;

/**
 * A parent collection owns keyboard focus and marks the active button with
 * `highlighted`, which paints the same outside ring as real focus.
 */
export default function ButtonHighlighted() {
  const [index, setIndex] = useState(1);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {actions.map((label, position) => (
        <Button
          key={label}
          variant="outline"
          highlighted={position === index}
          onFocus={() => setIndex(position)}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
