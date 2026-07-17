import type { ReactNode } from "react";
import { TuiFaultPanel } from "@/components/layout/tui-fault-panel";

export interface NotFoundStateProps {
  title: string;
  description: string;
  actionLabel: string;
  primaryAction: ReactNode;
  secondaryAction?: ReactNode;
}

export function NotFoundState({
  title,
  description,
  actionLabel,
  primaryAction,
  secondaryAction,
}: NotFoundStateProps) {
  return (
    <TuiFaultPanel
      statusCode="404"
      statusValue="NOT_FOUND"
      title={title}
      description={description}
      actionLabel={actionLabel}
      primaryAction={primaryAction}
      secondaryAction={secondaryAction}
    />
  );
}
