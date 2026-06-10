import type { ReactNode } from "react";
import { MobileNavProvider, useMobileNav } from "@/lib/mobile-nav-context";
import { CommandRow } from "./command-row";
import { FooterBar } from "./footer-bar";
import { StatusBar } from "./status-bar";

function TuiShellChrome({ children }: { children: ReactNode }) {
  const { open, isDesktop } = useMobileNav();
  const chromeInert = (open && !isDesktop) || undefined;

  return (
    <div className="tui-chrome flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <div className="contents" inert={chromeInert}>
        <StatusBar />
      </div>
      <div className="contents" inert={chromeInert}>
        <CommandRow />
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-2 py-2">
        {children}
      </div>
      <div className="contents" inert={chromeInert}>
        <FooterBar />
      </div>
    </div>
  );
}

export function TuiShell({ children }: { children: ReactNode }) {
  return (
    <MobileNavProvider>
      <TuiShellChrome>{children}</TuiShellChrome>
    </MobileNavProvider>
  );
}
