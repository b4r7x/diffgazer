import { KeyboardProvider } from "@diffgazer/keys";
import { Button } from "@diffgazer/ui/components/button";
import { Toaster } from "@diffgazer/ui/components/toast";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { createRootRoute, HeadContent, Outlet, Scripts, useRouter } from "@tanstack/react-router";
import { TanstackProvider } from "fumadocs-core/framework/tanstack";
import type { ReactNode } from "react";
import { GlobalNotFound } from "@/components/global-not-found";
import { TuiBracketLink } from "@/components/layout/tui-bracket-link";
import { TuiFaultPanel } from "@/components/layout/tui-fault-panel";
import { TuiShell } from "@/components/layout/tui-shell";
import { SearchDialog } from "@/features/search/components/dialog";
import { SearchProvider } from "@/hooks/search-context";
import { ThemeProvider } from "@/hooks/theme-context";
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

// Set data-theme before hydration so the persisted choice paints on first frame
// with no flash of the default theme. Mirrors the dark-mode docs flash-prevention
// pattern; falls back to "dark" (the lib default) when no preference is stored.
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("@diffgazer/docs-theme");document.documentElement.setAttribute("data-theme",t==="light"||t==="dark"?t:"dark");}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();`;

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  // Carry the per-request CSP nonce (server.ts) on the manually-injected theme
  // bootstrap; TanStack's own HeadContent/Scripts read the same nonce.
  const nonce = useRouter().options.ssr?.nonce;
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static no-flash theme bootstrap, no user input */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body className="ui-base min-h-screen">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootLayout() {
  return (
    <TanstackProvider>
      <ThemeProvider>
        <KeyboardProvider>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[calc(var(--z-toast)+1)] focus:bg-foreground focus:text-background focus:px-3 focus:py-1 focus:text-xs focus:font-mono"
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
      </ThemeProvider>
    </TanstackProvider>
  );
}

function RootErrorBoundary({ error, reset }: ErrorComponentProps) {
  return (
    <div className="docs-chrome flex h-dvh flex-col overflow-hidden bg-background text-foreground">
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
