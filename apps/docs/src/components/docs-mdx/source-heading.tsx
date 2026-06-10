import { Typography } from "@diffgazer/ui/components/typography";
import type { ReactNode } from "react";

export function SourceHeading({ children }: { children?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between mt-10 mb-4 pb-2 border-b border-border">
      <Typography as="h2" size="xl" id="source" className="font-bold text-foreground scroll-mt-16">
        Source
      </Typography>
      {children}
    </div>
  );
}
