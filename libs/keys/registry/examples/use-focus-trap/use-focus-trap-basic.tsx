"use client"

import { useRef, useState } from "react"
import { useFocusTrap } from "@diffgazer/keys"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import { Kbd } from "@/components/ui/kbd"

export default function UseFocusTrapBasic() {
  const [open, setOpen] = useState(false)
  const trapRef = useRef<HTMLDivElement>(null)

  useFocusTrap(trapRef, { enabled: open, restoreFocus: true })

  return (
    <div>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Open Panel
      </Button>

      {open && (
        <div ref={trapRef} className="mt-2">
          <Card size="sm">
            <CardHeader>
              <CardTitle as="h3">Confirm Action</CardTitle>
              <p className="text-xs text-muted-foreground">
                Press <Kbd size="sm">Tab</Kbd> to cycle through buttons. Focus is trapped within this panel.
              </p>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Focus cannot leave this area until the panel is dismissed.
              </p>
            </CardContent>
            <CardFooter className="gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => setOpen(false)}>Confirm</Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  )
}
