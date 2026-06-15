import { Spinner } from "@diffgazer/ui/components/spinner";
import type { ReactNode } from "react";

interface CenteredStatusProps {
  tone?: "info" | "error";
  children: ReactNode;
}

export function CenteredStatus({ tone = "info", children }: CenteredStatusProps) {
  if (tone === "error") {
    return (
      <div className="flex flex-1 items-center justify-center font-mono">
        <p role="alert" className="text-error-text text-sm">
          {children}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center font-mono">
      <Spinner className="text-muted-foreground">{children}</Spinner>
    </div>
  );
}
