import type { ReactNode } from "react";
import { Typography } from "@/components/ui/typography";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-4">
      <span className="w-20 shrink-0 text-xs text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      {children}
    </div>
  );
}

export default function TypographyHeadings() {
  return (
    <div className="space-y-3">
      <Row label="h1 · 3xl">
        <Typography as="h1">The quick brown fox</Typography>
      </Row>
      <Row label="h2 · 2xl">
        <Typography as="h2">The quick brown fox</Typography>
      </Row>
      <Row label="h3 · xl">
        <Typography as="h3">The quick brown fox</Typography>
      </Row>
      <Row label="h4 · lg">
        <Typography as="h4">The quick brown fox</Typography>
      </Row>
      <Row label="h5 · base">
        <Typography as="h5">The quick brown fox</Typography>
      </Row>
      <Row label="h6 · sm">
        <Typography as="h6">The quick brown fox</Typography>
      </Row>
    </div>
  );
}
