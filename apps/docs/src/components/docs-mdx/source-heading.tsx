import type { ReactNode } from "react";
import { SectionHeading } from "./section-heading";

export function SourceHeading({ children }: { children?: ReactNode }) {
  return (
    <SectionHeading id="source" action={children}>
      Source
    </SectionHeading>
  );
}
