import { useServerStatus } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import { Button } from "@diffgazer/ui/components/button";
import { Toaster } from "@diffgazer/ui/components/toast";
import { Typography } from "@diffgazer/ui/components/typography";
import { HeadContent } from "@tanstack/react-router";
import { GlobalLayout } from "@/components/layout/global";
import { RouteLoadingFallback } from "@/components/layout/route-loading-fallback";
import { RouteOutletBoundary } from "../route-error-boundary";

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

  if (state.status === "checking") {
    return (
      <div className="flex h-dvh flex-col">
        <RouteLoadingFallback />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center space-y-4 bg-background text-foreground">
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
