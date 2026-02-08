import React from "react";
import { Outlet } from "@tanstack/react-router";
import { Button, ToastProvider } from "@stargazer/ui";
import { GlobalLayout } from "@/components/layout";
import { FooterProvider } from "@/components/layout";
import { useServerStatus } from "@/hooks/use-server-status";

class RouteErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen items-center justify-center bg-tui-bg text-tui-fg font-mono">
          <div className="text-center">
            <p className="text-tui-red mb-2">Something went wrong</p>
            <p className="text-tui-muted text-sm">{this.state.error.message}</p>
            <button
              type="button"
              className="mt-4 px-4 py-2 border border-tui-border text-sm hover:bg-tui-border/20"
              onClick={() => {
                this.setState({ error: null });
                window.location.reload();
              }}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function RootLayout() {
  const { state, retry } = useServerStatus();

  if (state.status === "checking") {
    return (
      <div className="flex h-screen items-center justify-center bg-tui-bg text-tui-fg font-mono">
        <span className="text-tui-muted">Connecting...</span>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[--tui-bg] text-[--tui-fg] space-y-4">
        <h1 className="text-2xl font-bold text-[--tui-red]">
          Server Disconnected
        </h1>
        <p className="text-[--tui-fg] opacity-60">
          {state.message || "Could not connect to Stargazer server."}
        </p>
        <Button onClick={retry}>Retry Connection</Button>
      </div>
    );
  }

  return (
    <FooterProvider>
      <ToastProvider>
        <GlobalLayout>
          <RouteErrorBoundary>
            <Outlet />
          </RouteErrorBoundary>
        </GlobalLayout>
      </ToastProvider>
    </FooterProvider>
  );
}
