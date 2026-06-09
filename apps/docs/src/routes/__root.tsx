import { Button } from "@diffgazer/ui/components/button";
import { createRootRoute, HeadContent, Link, Outlet, Scripts } from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { DocsAppChrome } from "@/components/layout/docs-app-chrome";
import { TuiFaultPanel } from "@/components/layout/tui-fault-panel";
import { GlobalNotFound } from "@/components/global-not-found";
import { PRIMARY_DOCS_LIBRARY_ID } from "@/lib/library";
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
    <DocsAppChrome>
      <Outlet />
    </DocsAppChrome>
  );
}

function RootErrorBoundary({ error, reset }: ErrorComponentProps) {
  return (
    <DocsAppChrome>
      <main
        id="main-content"
        tabIndex={-1}
        className="flex min-h-0 min-w-0 flex-1 flex-col outline-none"
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
            <Link
              to="/$lib"
              params={{ lib: PRIMARY_DOCS_LIBRARY_ID }}
              className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              [ OPEN_DOCS ]
            </Link>
          }
        />
      </main>
    </DocsAppChrome>
  );
}

function RootNotFound() {
  return <GlobalNotFound />;
}
