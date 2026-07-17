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
import { THEME_INIT_SCRIPT, ThemeProvider } from "@/hooks/theme-context";
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

// Apply the persisted theme and synchronize the SSR toggle as its markup is parsed,
// before either can paint with stale dark-fallback state.
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

function RootErrorBoundary({ error }: ErrorComponentProps) {
  const router = useRouter();

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
          actionLabel="TRY_AGAIN"
          detail={import.meta.env.DEV ? error.message : undefined}
          primaryAction={
            <Button
              variant="primary"
              bracket
              onClick={() => void router.invalidate().catch(() => {})}
            >
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
