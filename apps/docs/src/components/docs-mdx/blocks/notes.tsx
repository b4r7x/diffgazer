"use client"

import { useHookData } from "../doc-data-context"

export function Notes() {
  const data = useHookData()
  if (!data?.docs?.notes?.length) return null

  return (
    <div className="space-y-3">
      {data.docs.notes.map((note) => (
        <div key={note.title} className="border-l-2 border-border pl-3 py-1">
          <h4 className="text-sm font-bold text-foreground mb-0.5">{note.title}</h4>
          <p className="text-sm text-muted-foreground">{note.content}</p>
        </div>
      ))}
    </div>
  )
}
