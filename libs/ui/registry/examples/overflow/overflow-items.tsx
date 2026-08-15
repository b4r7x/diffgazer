"use client";

import { Overflow } from "@/components/ui/overflow";

const tags = ["React", "TypeScript", "Tailwind", "Node.js", "Vitest", "Zod", "Prisma"];

// Each chip is passed as its own React child so Overflow measures them individually;
// a child may be any element or component, as long as one child means one measured item.
const CHIP_CLASS =
  "inline-flex items-center rounded-sm border border-foreground/30 px-2 py-0.5 font-mono text-xs text-foreground";

export default function OverflowItemsExample() {
  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-1.5">
        <span className="text-xs font-mono text-muted-foreground">
          default indicator — dashed badge shipped by the component
        </span>
        <div className="w-80 border border-dashed border-foreground/20 p-2">
          <Overflow mode="items" className="gap-1.5">
            {tags.map((tag) => (
              <span key={tag} className={CHIP_CLASS}>
                {tag}
              </span>
            ))}
          </Overflow>
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="text-xs font-mono text-muted-foreground">
          custom indicator — solid, tight radius, matches the chips
        </span>
        <div className="w-80 border border-dashed border-foreground/20 p-2">
          <Overflow
            mode="items"
            className="gap-1.5"
            indicator={({ count }) => (
              <span className="inline-flex items-center rounded-sm border border-foreground/30 bg-foreground/10 px-2 py-0.5 font-mono text-xs text-muted-foreground">
                +{count} more
              </span>
            )}
          >
            {tags.map((tag) => (
              <span key={tag} className={CHIP_CLASS}>
                {tag}
              </span>
            ))}
          </Overflow>
        </div>
      </div>
    </div>
  );
}
