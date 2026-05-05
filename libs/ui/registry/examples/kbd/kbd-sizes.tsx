import { Kbd } from "@/components/ui/kbd"

export default function KbdSizes() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Kbd size="sm">sm</Kbd>
      <Kbd size="md">md</Kbd>
    </div>
  )
}
