import { useServerStatus } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import { Toaster } from "@diffgazer/ui/components/toast";
import { HeadContent } from "@tanstack/react-router";
import { GlobalLayout } from "@/components/layout/global";
import { RouteLoadingFallback } from "@/components/layout/route-loading-fallback";
import { RouteOutletBoundary } from "../route-error-boundary";
import { ServerDisconnectedGate } from "../server-disconnected";

export function ConnectedRootLayout() {
  return (
    <FooterProvider>
      <HeadContent />
      <GlobalLayout>
        <RouteOutletBoundary />
      </GlobalLayout>
      <Toaster position="bottom-right" />
    </FooterProvider>
  );
}

export function RootLayout() {
  const { state, retry } = useServerStatus();

  const handleRetry = () => {
    void retry().catch(() => {});
  };

  if (state.status === "checking") {
    return (
      <div className="flex h-dvh flex-col">
        <RouteLoadingFallback />
      </div>
    );
  }

  if (state.status === "error") {
    return <ServerDisconnectedGate message={state.message} onRetry={handleRetry} />;
  }

  return <ConnectedRootLayout />;
}
