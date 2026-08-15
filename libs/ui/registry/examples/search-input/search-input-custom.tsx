"use client";

import { useState } from "react";
import { SearchInput } from "@/components/ui/search-input";

export default function SearchInputCustom() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  return (
    <div className="flex flex-col gap-4">
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Type and press Enter..."
        onEnter={() => setSubmitted(query.trim())}
        // SearchInput clears a non-empty value itself; onEscape only fires once the
        // input is already empty, so this discards the last result.
        onEscape={() => setSubmitted("")}
        prefix={
          <span className="text-foreground font-bold" aria-hidden="true">
            $
          </span>
        }
      />
      <output className="font-mono text-xs text-muted-foreground">
        {submitted ? `Searched for "${submitted}"` : "Nothing searched yet"}
      </output>
      <SearchInput
        defaultValue=""
        placeholder="Uncontrolled search"
        prefix={
          <span className="text-foreground font-bold" aria-hidden="true">
            &gt;
          </span>
        }
      />
    </div>
  );
}
