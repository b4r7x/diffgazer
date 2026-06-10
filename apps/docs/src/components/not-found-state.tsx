import type { ReactNode } from "react";
import { TuiFaultPanel } from "@/components/layout/tui-fault-panel";

export interface NotFoundStateProps {
  title: string;
  description: string;
  primaryAction: ReactNode;
  secondaryAction?: ReactNode;
}

export function NotFoundState({
  title,
  description,
  primaryAction,
  secondaryAction,
}: NotFoundStateProps) {
  return (
    <TuiFaultPanel
      statusCode="404"
      statusValue="NOT_FOUND"
      title={title}
      description={description}
      primaryAction={primaryAction}
      secondaryAction={secondaryAction}
    />
  );
}
