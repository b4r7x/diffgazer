import type { ReactNode } from "react";
import { MobileNavProvider } from "@/lib/mobile-nav-context";
import { CommandRow } from "./command-row";
import { FooterBar } from "./footer-bar";
import { StatusBar } from "./status-bar";

export function TuiShell({ children }: { children: ReactNode }) {
  return (
    <MobileNavProvider>
      <div className="tui-chrome flex h-screen flex-col overflow-hidden bg-background text-foreground">
        <StatusBar />
        <CommandRow />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-2 py-2">
          {children}
        </div>
        <FooterBar />
      </div>
    </MobileNavProvider>
  );
}
