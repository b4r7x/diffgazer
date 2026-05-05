import { Kbd, KbdGroup } from "@/components/ui/kbd"

export default function KbdGroupExample() {
  return (
    <div className="flex flex-col gap-4">
      <KbdGroup>
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
      </KbdGroup>
      <KbdGroup>
        <Kbd>Ctrl</Kbd>
        <span className="text-muted-foreground text-xs">+</span>
        <Kbd>Shift</Kbd>
        <span className="text-muted-foreground text-xs">+</span>
        <Kbd>P</Kbd>
      </KbdGroup>
    </div>
  )
}
