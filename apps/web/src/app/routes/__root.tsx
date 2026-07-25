import { useServerStatus } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import { Button } from "@diffgazer/ui/components/button";
import { Toaster } from "@diffgazer/ui/components/toast";
import { Typography } from "@diffgazer/ui/components/typography";
import { HeadContent, useRouter } from "@tanstack/react-router";
import { GlobalLayout } from "@/components/layout/global";
import { RouteLoadingFallback } from "@/components/layout/route-loading-fallback";
import { RouteOutletBoundary } from "../route-error-boundary";

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
