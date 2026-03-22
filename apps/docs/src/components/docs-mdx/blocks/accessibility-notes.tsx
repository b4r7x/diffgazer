"use client"

import { useComponentData } from "../doc-data-context"

export function AccessibilityNotes() {
  const data = useComponentData()

  const anatomy = data?.docs?.anatomy
  const notes = data?.docs?.notes

  if (!anatomy?.length && !notes?.length) return null

  return (
    <div className="space-y-6">
      {notes && notes.length > 0 && (
        <div>
          <h3 className="font-bold text-sm text-foreground mb-3">Notes</h3>
          {notes.map((note, i) => (
            <div key={i} className="mb-4">
              <h4 className="text-sm font-bold text-foreground mb-1">{note.title}</h4>
              <p className="text-sm text-muted-foreground">{note.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
