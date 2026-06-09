import { TuiFaultPanel } from "@/components/layout/tui-fault-panel";
import type { ReactNode } from "react";

export interface NotFoundStateProps {
  statusLabel?: string;
  title: string;
  description: string;
  primaryAction: ReactNode;
  secondaryAction?: ReactNode;
}

export function NotFoundState({
  statusLabel = "404",
  title,
  description,
  primaryAction,
  secondaryAction,
}: NotFoundStateProps) {
  return (
    <TuiFaultPanel
      statusCode={statusLabel}
      statusValue="NOT_FOUND"
      title={title}
      description={description}
      primaryAction={primaryAction}
      secondaryAction={secondaryAction}
    />
  );
}
