import { Overflow } from "@/components/ui/overflow"

const tags = ["React", "TypeScript", "Tailwind", "Node.js", "Vitest", "Zod", "Prisma"]

export default function OverflowItemsExample() {
  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-1.5">
        <span className="text-xs font-mono text-muted-foreground">default indicator</span>
        <div className="w-80 border border-dashed border-foreground/20 p-2">
          <Overflow mode="items" gap="gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center border border-foreground/30 px-2 py-0.5 font-mono text-xs text-foreground"
              >
                {tag}
              </span>
            ))}
          </Overflow>
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="text-xs font-mono text-muted-foreground">custom indicator</span>
        <div className="w-80 border border-dashed border-foreground/20 p-2">
          <Overflow
            mode="items"
            gap="gap-1.5"
            indicator={({ count }) => (
              <span className="inline-flex items-center rounded-full bg-foreground/10 px-2 py-0.5 font-mono text-xs text-muted-foreground">
                +{count} more
              </span>
            )}
          >
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center border border-foreground/30 px-2 py-0.5 font-mono text-xs text-foreground"
              >
                {tag}
              </span>
            ))}
          </Overflow>
        </div>
      </div>
    </div>
  )
}
