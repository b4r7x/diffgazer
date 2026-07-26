import { cn } from "@diffgazer/ui/lib/utils";
import type { ReactNode } from "react";
import { MobileNavProvider, useMobileNav } from "@/hooks/mobile-nav-context";
import { DOCS_SHELL_CLASS } from "@/lib/docs-chrome";
import { CommandRow } from "./command-row";
import { FooterBar } from "./footer-bar";
import { StatusBar } from "./status-bar";

function TuiShellChrome({ children }: { children: ReactNode }) {
  const { open, isDesktop } = useMobileNav();
  const chromeInert = (open && !isDesktop) || undefined;

  return (
    // group/shell lets the command row's nav toggle ask whether this surface
    // rendered a drawer at all, without waiting for the route to report in.
    <div className={cn(DOCS_SHELL_CLASS, "group/shell")}>
      <div className="contents" inert={chromeInert}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[calc(var(--z-toast)+1)] focus:bg-foreground focus:text-background focus:px-3 focus:py-1 focus:text-xs focus:font-mono"
        >
          Skip to content
        </a>
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
