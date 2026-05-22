import { Typography } from "@/components/ui/typography/typography"
import { useHookData } from "../doc-data-context"

export function Notes() {
  const data = useHookData()
  if (!data?.docs?.notes?.length) return null

  return (
    <div className="space-y-3">
      {data.docs.notes.map((note) => (
        <div key={note.title} className="border-l-2 border-border pl-3 py-1">
          <Typography as="h4" size="sm" className="font-bold text-foreground mb-0.5">{note.title}</Typography>
          <Typography as="p" size="sm">{note.content}</Typography>
        </div>
      ))}
    </div>
  )
}
