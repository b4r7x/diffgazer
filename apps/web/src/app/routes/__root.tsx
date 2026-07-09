import { useServerStatus } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import { Button } from "@diffgazer/ui/components/button";
import { Toaster } from "@diffgazer/ui/components/toast";
import { Typography } from "@diffgazer/ui/components/typography";
import { HeadContent, Link, Outlet, useRouter } from "@tanstack/react-router";
import React from "react";
import { GlobalLayout } from "@/components/layout/global";
import { RouteLoadingFallback } from "@/components/layout/route-loading-fallback";

interface RouteErrorBoundaryProps {
  children: React.ReactNode;
  onReset: () => void;
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
    this.setState({ error: null });
    this.props.onReset();
  };

  override render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          className="flex h-screen items-center justify-center bg-background text-foreground font-mono"
        >
          <div className="text-center">
            <p className="text-error-text mb-2">Something went wrong</p>
            {import.meta.env.DEV ? (
              <p className="text-muted-foreground text-sm">{this.state.error.message}</p>
            ) : null}
            <Button variant="secondary" className="mt-4" onClick={this.handleRetry}>
              Try again
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function NotFoundPage() {
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

export function RootLayout() {
  const { state, retry } = useServerStatus();
  const router = useRouter();

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

  return (
    <FooterProvider>
      <HeadContent />
      <GlobalLayout>
        <RouteErrorBoundary onReset={() => void router.invalidate().catch(() => {})}>
          <div className="flex flex-1 flex-col min-h-0">
            <Outlet />
          </div>
        </RouteErrorBoundary>
      </GlobalLayout>
      <Toaster position="bottom-right" />
    </FooterProvider>
  );
}
