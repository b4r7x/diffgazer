import { Overflow } from "@/components/ui/overflow"
import { Avatar } from "@/components/ui/avatar"

const users = [
  { initials: "FX", name: "Felix" },
  { initials: "AR", name: "Aria" },
  { initials: "DV", name: "Dev" },
  { initials: "KI", name: "Kai" },
  { initials: "NV", name: "Nova" },
  { initials: "ZR", name: "Zara" },
  { initials: "LN", name: "Luna" },
  { initials: "RX", name: "Rex" },
]

export default function OverflowAvatarsExample() {
  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-1.5">
        <span className="text-xs font-mono text-muted-foreground">w-32</span>
        <div className="w-32 border border-dashed border-foreground/20 p-2">
          <Overflow
            mode="items"
            gap="gap-1"
            indicator={({ count }) => (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-dashed border-foreground/30 font-mono text-[10px] text-muted-foreground">
                +{count}
              </span>
            )}
          >
            {users.map((u) => (
              <Avatar key={u.initials} fallback={u.initials} size="sm" />
            ))}
          </Overflow>
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="text-xs font-mono text-muted-foreground">w-48</span>
        <div className="w-48 border border-dashed border-foreground/20 p-2">
          <Overflow
            mode="items"
            gap="gap-1"
            indicator={({ count }) => (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-dashed border-foreground/30 font-mono text-[10px] text-muted-foreground">
                +{count}
              </span>
            )}
          >
            {users.map((u) => (
              <Avatar key={u.initials} fallback={u.initials} size="sm" />
            ))}
          </Overflow>
        </div>
      </div>
    </div>
  )
}
