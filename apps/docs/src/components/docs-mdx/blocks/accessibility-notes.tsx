import { Typography } from "@/components/ui/typography/typography"
import { useComponentData } from "../doc-data-context"

export function AccessibilityNotes() {
  const data = useComponentData()
  const notes = data?.docs?.notes

  if (!notes?.length) return null

  return (
    <div className="space-y-6">
      <div>
        <Typography as="h3" size="sm" className="font-bold text-foreground mb-3">Notes</Typography>
        {notes.map((note, i) => (
          <div key={i} className="mb-4">
            <Typography as="h4" size="sm" className="font-bold text-foreground mb-1">{note.title}</Typography>
            <Typography as="p" size="sm">{note.content}</Typography>
          </div>
        ))}
      </div>
    </div>
  )
}
