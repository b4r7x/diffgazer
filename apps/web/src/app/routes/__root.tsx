import { Outlet } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { GlobalLayout } from "@/components/layout";
import { FooterProvider } from "@/components/layout";
import { ToastProvider } from "@/components/ui/toast";
import { useServerStatus } from "@/hooks/use-server-status";

export function RootLayout() {
  const { state, retry } = useServerStatus();

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
          <Outlet />
        </GlobalLayout>
      </ToastProvider>
    </FooterProvider>
  );
}
