import { KeyboardProvider } from "@diffgazer/keys";
import { Toaster } from "@diffgazer/ui/components/toast";
import { TanstackProvider } from "fumadocs-core/framework/tanstack";
import type { ReactNode } from "react";
import { SearchDialog } from "@/features/search/components/dialog";
import { SearchProvider } from "@/lib/search-context";
import { TuiShell } from "./tui-shell";

export function DocsAppChrome({ children }: { children: ReactNode }) {
  return (
    <TanstackProvider>
      <KeyboardProvider>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[60] focus:bg-foreground focus:text-background focus:px-3 focus:py-1 focus:text-xs focus:font-mono"
        >
          Skip to content
        </a>
        <SearchProvider>
          <TuiShell>{children}</TuiShell>
          <SearchDialog />
        </SearchProvider>
        <Toaster />
      </KeyboardProvider>
    </TanstackProvider>
  );
}
