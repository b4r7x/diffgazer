"use client"

import { useState } from "react"
import { useControllableState } from "@/hooks/use-controllable-state"

function CustomInput({
  value,
  defaultValue = "",
  onChange,
}: {
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
}) {
  const [current, setCurrent] = useControllableState({
    value,
    defaultValue,
    onChange,
  })

  return (
    <input
      className="border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-100"
      value={current}
      onChange={(e) => setCurrent(e.target.value)}
    />
  )
}

export default function ControllableStateBasic() {
  const [controlled, setControlled] = useState("hello")

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-neutral-400">Uncontrolled</span>
        <CustomInput defaultValue="type here…" />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-neutral-400">
          Controlled: {controlled}
        </span>
        <CustomInput value={controlled} onChange={setControlled} />
      </div>
    </div>
  )
}
