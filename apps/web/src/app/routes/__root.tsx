import { Outlet } from "@tanstack/react-router"
import { Header } from "@/components/layout/header"
import { FooterBar } from "@/components/layout/footer-bar"
import { useServerStatus } from "@/hooks/use-server-status"
import { useConfig } from "@/features/settings/hooks/use-config"
import { Button } from "@/components/ui/button"

export function RootLayout() {
    const { connected, isChecking, error, retry } = useServerStatus();
    // Pre-fetch config to ensure it's available
    useConfig();

    if (!isChecking && !connected) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground space-y-4">
                <h1 className="text-2xl font-bold text-destructive">Server Disconnected</h1>
                <p className="text-muted-foreground">{error || "Could not connect to Stargazer server."}</p>
                <Button onClick={retry}>Retry Connection</Button>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-background font-sans antialiased text-foreground">
            <Header />
            <main className="flex-1 overflow-hidden flex flex-col">
                <Outlet />
            </main>
            <FooterBar />
        </div>
    )
}
