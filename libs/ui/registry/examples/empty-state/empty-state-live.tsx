"use client";

import { useState } from "react";
import { EmptyState, EmptyStateDescription, EmptyStateMessage } from "@/components/ui/empty-state";

const items = ["useNavigation", "useFocusTrap", "useScrollLock"];

export default function EmptyStateLive() {
  const [query, setQuery] = useState("");
  const filtered = items.filter((item) => item.toLowerCase().includes(query.toLowerCase()));
  const isEmpty = filtered.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <input
        type="search"
        aria-label="Filter hooks"
        placeholder="Filter hooks…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="border border-border bg-background px-3 py-1.5 text-sm text-foreground"
      />
      {filtered.length > 0 && (
        <ul className="text-sm text-foreground">
          {filtered.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
      {/* The live region stays mounted across the results→empty transition (and
          starts empty) so screen readers announce the message when it appears. */}
      <EmptyState live size="sm">
        {isEmpty ? (
          <>
            <EmptyStateMessage>No hooks match "{query}"</EmptyStateMessage>
            <EmptyStateDescription>Try a different search term.</EmptyStateDescription>
          </>
        ) : null}
      </EmptyState>
    </div>
  );
}
