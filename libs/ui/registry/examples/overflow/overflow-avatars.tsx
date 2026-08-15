"use client";

import { Avatar } from "@/components/ui/avatar";
import { Overflow } from "@/components/ui/overflow";

const users = [
  { initials: "FX", name: "Felix" },
  { initials: "AR", name: "Aria" },
  { initials: "DV", name: "Dev" },
  { initials: "KI", name: "Kai" },
  { initials: "NV", name: "Nova" },
  { initials: "ZR", name: "Zara" },
  { initials: "LN", name: "Luna" },
  { initials: "RX", name: "Rex" },
];

// Custom count chip: solid border and tight radius, matching the avatar chips.
// The dashed border is reserved for the component's own default indicator.
const COUNT_CHIP_CLASS =
  "flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border border-foreground/30 font-mono text-2xs text-muted-foreground";

export default function OverflowAvatarsExample() {
  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-1.5">
        <span className="text-xs font-mono text-muted-foreground">w-32</span>
        <div className="w-32 border border-dashed border-foreground/20 p-2">
          <Overflow
            mode="items"
            indicator={({ count }) => <span className={COUNT_CHIP_CLASS}>+{count}</span>}
          >
            {users.map((u) => (
              <Avatar key={u.initials} alt={u.name} fallback={u.initials} size="sm" />
            ))}
          </Overflow>
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="text-xs font-mono text-muted-foreground">w-48</span>
        <div className="w-48 border border-dashed border-foreground/20 p-2">
          <Overflow
            mode="items"
            indicator={({ count }) => <span className={COUNT_CHIP_CLASS}>+{count}</span>}
          >
            {users.map((u) => (
              <Avatar key={u.initials} alt={u.name} fallback={u.initials} size="sm" />
            ))}
          </Overflow>
        </div>
      </div>
    </div>
  );
}
