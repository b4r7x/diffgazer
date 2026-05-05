import { Kbd } from "@/components/ui/kbd"

export default function KbdInline() {
  return (
    <p className="text-sm text-muted-foreground">
      Press <Kbd>Esc</Kbd> to close the dialog, or <Kbd>Enter</Kbd> to confirm.
    </p>
  )
}
