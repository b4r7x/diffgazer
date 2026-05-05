"use client";

import { useState } from "react"
import { SearchInput } from "@/components/ui/search-input"

export default function SearchInputCustom() {
  const [query, setQuery] = useState("")
  return (
    <div className="flex flex-col gap-4">
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Type and press Enter..."
        onEscape={() => setQuery("")}
        prefix={<span className="text-success font-bold">$</span>}
      />
      <SearchInput
        defaultValue=""
        placeholder="Uncontrolled search"
        prefix={<span className="text-muted-foreground font-bold">&gt;</span>}
      />
    </div>
  )
}
