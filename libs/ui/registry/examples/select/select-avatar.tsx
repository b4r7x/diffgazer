"use client";

import { useState } from "react"
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select"
import { Avatar } from "@/components/ui/avatar"
import { Overflow } from "@/components/ui/overflow"

const users = [
  { value: "felix", label: "Felix", initials: "FX" },
  { value: "aria", label: "Aria", initials: "AR" },
  { value: "dev", label: "Dev", initials: "DV" },
  { value: "kai", label: "Kai", initials: "KI" },
  { value: "nova", label: "Nova", initials: "NV" },
]

export default function SelectAvatar() {
  const [value, setValue] = useState<string[]>([])

  return (
    <Select multiple value={value} onChange={setValue} width="lg">
      <SelectTrigger>
        <SelectValue placeholder="Assign members...">
          {({ selected }) => (
            <Overflow
              mode="items"
              gap="gap-1"
              indicator={({ count }) => (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-dashed border-foreground/30 font-mono text-[10px] text-muted-foreground">
                  +{count}
                </span>
              )}
            >
              {selected.map((v) => {
                const user = users.find((u) => u.value === v)
                return (
                  <Avatar
                    key={v}
                    fallback={user?.initials ?? "?"}
                    size="sm"
                  />
                )
              })}
            </Overflow>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {users.map((user) => (
          <SelectItem key={user.value} value={user.value}>
            <span className="inline-flex items-center gap-2">
              <Avatar fallback={user.initials} size="sm" />
              {user.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
