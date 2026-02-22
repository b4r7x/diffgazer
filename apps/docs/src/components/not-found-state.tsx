import type { ReactNode } from "react";
import {
  EmptyState,
  EmptyStateActions,
  EmptyStateDescription,
  EmptyStateMessage,
} from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header/section-header";
import { cn } from "@/lib/utils";

type NotFoundVariant = "docs" | "global";

export interface NotFoundStateProps {
  variant?: NotFoundVariant;
  statusLabel?: string;
  title: string;
  description: string;
  primaryAction: ReactNode;
  secondaryAction?: ReactNode;
}

const containerVariants: Record<NotFoundVariant, string> = {
  docs: "min-h-full flex justify-center items-center",
  global: "min-h-screen flex justify-center items-center",
};

const contentVariants: Record<NotFoundVariant, string> = {
  docs: "w-full max-w-3xl border border-border bg-secondary/20 px-6 py-7 text-center",
  global: "w-full max-w-2xl text-center",
};

export function NotFoundState({
  variant = "global",
  statusLabel = "404",
  title,
  description,
  primaryAction,
  secondaryAction,
}: NotFoundStateProps) {
  return (
    <div className={cn("flex flex-col", containerVariants[variant])}>
      <SectionHeader className="mb-4 font-mono text-center">
        {statusLabel}
      </SectionHeader>

      <div className={contentVariants[variant]}>
        <EmptyState variant="centered" className="py-0">
          <EmptyStateMessage>
            <h1 className="font-mono text-2xl font-bold text-foreground">
              {title}
            </h1>
          </EmptyStateMessage>
          <EmptyStateDescription>{description}</EmptyStateDescription>
          <EmptyStateActions>
            <div className="mt-5 flex items-center justify-center gap-3">
              {primaryAction}
              {secondaryAction}
            </div>
          </EmptyStateActions>
        </EmptyState>
      </div>
    </div>
  );
}
