import { Kbd } from "@/components/ui/kbd"

export default function KbdDefault() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Kbd>Esc</Kbd>
      <Kbd>Enter</Kbd>
      <Kbd>Shift</Kbd>
      <Kbd>Tab</Kbd>
      <Kbd>Ctrl</Kbd>
    </div>
  )
}
