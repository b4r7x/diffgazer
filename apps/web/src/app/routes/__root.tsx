import { useServerStatus } from "@diffgazer/core/api/hooks";
import { FooterProvider, usePageFooter } from "@diffgazer/core/footer";
import { Button } from "@diffgazer/ui/components/button";
import { Toaster } from "@diffgazer/ui/components/toast";
import { Typography } from "@diffgazer/ui/components/typography";
import {
  type ErrorComponentProps,
  HeadContent,
  Link,
  Outlet,
  useLocation,
  useRouter,
} from "@tanstack/react-router";
import React, { useEffect } from "react";
import { GlobalLayout } from "@/components/layout/global";
import { RouteLoadingFallback } from "@/components/layout/route-loading-fallback";
import { RouteModuleImportError } from "../route-import";

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

const EMPTY_FOOTER_SHORTCUTS: [] = [];

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
      className="flex h-screen items-center justify-center bg-background text-foreground font-mono"
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

export function NotFoundPage() {
  useEffect(() => {
    const previousTitle = document.title;
    const notFoundTitle = "Page not found — Diffgazer";
    document.title = notFoundTitle;

    return () => {
      if (document.title === notFoundTitle) document.title = previousTitle;
    };
  }, []);

  return (
    <div className="flex flex-1 items-center justify-center bg-background text-foreground font-mono">
      <div className="text-center">
        <Typography as="h1" size="2xl" className="text-error-text mb-2">
          Page not found
        </Typography>
        <p className="text-muted-foreground text-sm mb-4">
          The page you were looking for does not exist.
        </p>
        <Button variant="secondary">
          {({ className }) => (
            <Link to="/" className={className}>
              Go home
            </Link>
          )}
        </Button>
      </div>
    </div>
  );
}

export function ConnectedRootLayout({
  reloadDocument = () => window.location.reload(),
}: {
  reloadDocument?: () => void;
} = {}) {
  return (
    <FooterProvider>
      <HeadContent />
      <GlobalLayout>
        <ConnectedRouteOutlet reloadDocument={reloadDocument} />
      </GlobalLayout>
      <Toaster position="bottom-right" />
    </FooterProvider>
  );
}

export function ConnectedRouteOutlet({ reloadDocument }: { reloadDocument: () => void }) {
  const router = useRouter();
  return (
    <RouteOutletBoundary
      onReset={() => void router.invalidate().catch(() => {})}
      onReload={reloadDocument}
    />
  );
}

interface LocationAwareRouteErrorBoundaryProps {
  children: React.ReactNode;
  onReset: () => void;
  onReload: () => void;
}

export function LocationAwareRouteErrorBoundary({
  children,
  onReset,
  onReload,
}: LocationAwareRouteErrorBoundaryProps) {
  const routeIdentity = useLocation({ select: (location) => location.href });

  return (
    <RouteErrorBoundary key={routeIdentity} onReset={onReset} onReload={onReload} clearFooter>
      {children}
    </RouteErrorBoundary>
  );
}

export function RouteOutletBoundary({
  onReset,
  onReload,
}: {
  onReset: () => void;
  onReload: () => void;
}) {
  return (
    <LocationAwareRouteErrorBoundary onReset={onReset} onReload={onReload}>
      <div className="flex flex-1 flex-col min-h-0">
        <Outlet />
      </div>
    </LocationAwareRouteErrorBoundary>
  );
}

export function RootLayout() {
  const { state, retry } = useServerStatus();

  if (state.status === "checking") {
    return (
      <div className="flex h-screen flex-col">
        <RouteLoadingFallback />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground space-y-4">
        <Typography as="h1" size="2xl" className="text-error-text">
          Server Disconnected
        </Typography>
        <p className="text-foreground opacity-60">
          {state.message || "Could not connect to Diffgazer server."}
        </p>
        <Button
          onClick={() => {
            void retry().catch(() => {});
          }}
        >
          Retry Connection
        </Button>
      </div>
    );
  }

  return <ConnectedRootLayout />;
}
