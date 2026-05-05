"use client"

import { useState } from "react"
import { KeyboardProvider, useKey } from "@diffgazer/keys"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Kbd, KbdGroup } from "@/components/ui/kbd"

function TextFormatter() {
  const [style, setStyle] = useState("normal")

  useKey({
    "ctrl+b": () => setStyle("bold"),
    "ctrl+i": () => setStyle("italic"),
    "ctrl+u": () => setStyle("underline"),
    Escape: () => setStyle("normal"),
  })

  const badgeVariant = style === "normal" ? "neutral" as const : "info" as const

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle as="h3">Text Formatter</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p
          className={
            style === "bold" ? "font-bold" :
            style === "italic" ? "italic" :
            style === "underline" ? "underline" :
            ""
          }
        >
          The quick brown fox jumps over the lazy dog.
        </p>
        <Badge variant={badgeVariant} dot>
          {style}
        </Badge>
        <p className="text-xs text-muted-foreground">
          <KbdGroup><Kbd size="sm">Ctrl</Kbd><Kbd size="sm">B</Kbd></KbdGroup> bold
          {" "}<KbdGroup><Kbd size="sm">Ctrl</Kbd><Kbd size="sm">I</Kbd></KbdGroup> italic
          {" "}<KbdGroup><Kbd size="sm">Ctrl</Kbd><Kbd size="sm">U</Kbd></KbdGroup> underline
          {" "}<Kbd size="sm">Esc</Kbd> reset
        </p>
      </CardContent>
    </Card>
  )
}

export default function UseKeyMap() {
  return (
    <KeyboardProvider>
      <TextFormatter />
    </KeyboardProvider>
  )
}
