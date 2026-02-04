import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface WizardLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function WizardLayout({
  title,
  subtitle,
  children,
  footer,
  className,
}: WizardLayoutProps) {
  return (
    <div className={cn("flex-1 flex flex-col items-center justify-center px-4", className)}>
      <div className="w-full max-w-lg border border-tui-border bg-tui-bg shadow-2xl">
        {/* Header */}
        <div className="border-b border-tui-border bg-tui-selection/30 px-6 py-4">
          <h1 className="text-xl font-bold text-tui-blue tracking-wide">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>

        {/* Content */}
        <div className="px-6 py-6">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="border-t border-tui-border px-6 py-4 flex justify-end gap-3 bg-tui-bg/50">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
