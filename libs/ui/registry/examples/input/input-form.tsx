"use client";

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

export default function InputForm() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  return (
    <div className="flex flex-col gap-4 max-w-sm">
      <div>
        <label htmlFor="if-name" className="text-xs text-muted-foreground uppercase font-bold mb-1 block">Name</label>
        <Input id="if-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
      </div>
      <div>
        <label htmlFor="if-email" className="text-xs text-muted-foreground uppercase font-bold mb-1 block">Email</label>
        <Input id="if-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </div>
      <div>
        <label htmlFor="if-message" className="text-xs text-muted-foreground uppercase font-bold mb-1 block">Message</label>
        <Textarea id="if-message" placeholder="Tell us more..." />
      </div>
    </div>
  )
}
