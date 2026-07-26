import { usePageFooter } from "@diffgazer/core/footer";
import type { Shortcut } from "@diffgazer/core/schemas/presentation";
import { Button } from "@diffgazer/ui/components/button";
import { type ErrorComponentProps, Outlet, useLocation, useRouter } from "@tanstack/react-router";
import React from "react";
import { RouteModuleImportError } from "./route-import";

interface RouteErrorBoundaryProps {
  children: React.ReactNode;
  onReset: () => void;
  onReload: () => void;
  clearFooter?: boolean;
}

interface RouteErrorBoundaryState {
  error: Error | null;
}

export class RouteErrorBoundary extends React.Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  override state: RouteErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { error };
  }

  private readonly handleRetry = () => {
    if (this.state.error instanceof RouteModuleImportError) {
      this.props.onReload();
      return;
    }
    this.setState({ error: null });
    this.props.onReset();
  };

  override render() {
    if (this.state.error) {
      return (
        <RouteErrorFallback
          error={this.state.error}
          onRetry={this.handleRetry}
          clearFooter={this.props.clearFooter}
        />
      );
    }
    return this.props.children;
  }
}

// Hoisted for a stable identity — an inline `[]` would give `usePageFooter` a
// new array every render.
const EMPTY_FOOTER_SHORTCUTS: Shortcut[] = [];

function ClearPageFooter() {
  usePageFooter({
    shortcuts: EMPTY_FOOTER_SHORTCUTS,
    rightShortcuts: EMPTY_FOOTER_SHORTCUTS,
  });
  return null;
}

function RouteErrorFallback({
  error,
  onRetry,
  clearFooter = false,
}: {
  error: Error;
  onRetry: () => void;
  clearFooter?: boolean;
}) {
  return (
    <div
      role="alert"
      className="flex h-dvh items-center justify-center bg-background text-foreground font-mono"
    >
      {clearFooter ? <ClearPageFooter /> : null}
      <div className="text-center">
        <p className="text-error-text mb-2">Something went wrong</p>
        {import.meta.env.DEV ? (
          <p className="text-muted-foreground text-sm">{error.message}</p>
        ) : null}
        <Button variant="secondary" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </div>
  );
}

export function RouteRecoveryPage({
  error,
  reloadDocument = () => window.location.reload(),
  clearFooter = true,
}: ErrorComponentProps & { reloadDocument?: () => void; clearFooter?: boolean }) {
  const router = useRouter();
  const handleRetry = () => {
    if (error instanceof RouteModuleImportError) {
      reloadDocument();
      return;
    }
    void router.invalidate().catch(() => {});
  };

  return <RouteErrorFallback error={error} onRetry={handleRetry} clearFooter={clearFooter} />;
}

export function RouteOutletBoundary({
  onReset,
  onReload,
}: {
  onReset: () => void;
  onReload: () => void;
}) {
  // Keyed by location so navigating away from a broken route remounts the
  // boundary and clears the caught error without a manual retry.
  const routeIdentity = useLocation({ select: (location) => location.href });

  return (
    <RouteErrorBoundary key={routeIdentity} onReset={onReset} onReload={onReload} clearFooter>
      <div className="flex flex-1 flex-col min-h-0">
        <Outlet />
      </div>
    </RouteErrorBoundary>
  );
}
