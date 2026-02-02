import { Outlet } from "@tanstack/react-router";
import { useServerStatus } from "@/hooks/use-server-status";
import { Button } from "@/components/ui/button";
import { GlobalLayout, FooterProvider, ToastProvider } from "@/components/layout";

export function RootLayout() {
  const { connected, isChecking, error, retry } = useServerStatus();

  if (!isChecking && !connected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[--tui-bg] text-[--tui-fg] space-y-4">
        <h1 className="text-2xl font-bold text-[--tui-red]">
          Server Disconnected
        </h1>
        <p className="text-[--tui-fg] opacity-60">
          {error || "Could not connect to Stargazer server."}
        </p>
        <Button onClick={retry}>Retry Connection</Button>
      </div>
    );
  }

  return (
    <FooterProvider>
      <ToastProvider>
        <GlobalLayout>
          <Outlet />
        </GlobalLayout>
      </ToastProvider>
    </FooterProvider>
  );
}
