import { KeyboardProvider } from "@diffgazer/keys";
import { Button } from "@diffgazer/ui/components/button";
import { Toaster } from "@diffgazer/ui/components/toast";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { TanstackProvider } from "fumadocs-core/framework/tanstack";
import type { ReactNode } from "react";
import { GlobalNotFound } from "@/components/global-not-found";
import { TuiBracketLink } from "@/components/layout/tui-bracket-link";
import { TuiFaultPanel } from "@/components/layout/tui-fault-panel";
import { TuiShell } from "@/components/layout/tui-shell";
import { SearchDialog } from "@/features/search/components/dialog";
import { PRIMARY_DOCS_LIBRARY_ID } from "@/lib/library";
import { SearchProvider } from "@/lib/search-context";
import { buildRootHeadDefaults } from "@/lib/seo";
import appCss from "../index.css?url";

export const Route = createRootRoute({
  head: () => {
    const { meta, links: defaultLinks } = buildRootHeadDefaults();
    return {
      meta,
      links: [
        ...defaultLinks,
        {
          rel: "preconnect",
          href: "https://fonts.googleapis.com",
        },
        {
          rel: "preconnect",
          href: "https://fonts.gstatic.com",
          crossOrigin: "anonymous",
        },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap",
        },
        {
          rel: "stylesheet",
          href: appCss,
        },
      ],
    };
  },

  shellComponent: RootDocument,
  component: RootLayout,
  notFoundComponent: RootNotFound,
  errorComponent: RootErrorBoundary,
});

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="tui-base min-h-screen">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootLayout() {
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
          <TuiShell>
            <Outlet />
          </TuiShell>
          <SearchDialog />
        </SearchProvider>
        <Toaster />
      </KeyboardProvider>
    </TanstackProvider>
  );
}

function RootErrorBoundary({ error, reset }: ErrorComponentProps) {
  return (
    <div className="tui-chrome flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <main
        id="main-content"
        tabIndex={-1}
        className="flex min-h-0 min-w-0 flex-1 flex-col outline-hidden"
      >
        <TuiFaultPanel
          statusCode="ERR_RENDER"
          title="Something went wrong"
          description="An unexpected error occurred while rendering this page."
          detail={import.meta.env.DEV ? error.message : undefined}
          primaryAction={
            <Button variant="primary" bracket onClick={() => reset()}>
              Try again
            </Button>
          }
          secondaryAction={
            <TuiBracketLink to="/$lib" params={{ lib: PRIMARY_DOCS_LIBRARY_ID }}>
              OPEN_DOCS
            </TuiBracketLink>
          }
        />
      </main>
    </div>
  );
}

function RootNotFound() {
  return <GlobalNotFound />;
}
