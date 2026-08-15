import { KeyboardProvider } from "@diffgazer/keys";
import { Button } from "@diffgazer/ui/components/button";
import { Toaster } from "@diffgazer/ui/components/toast";
import { cn } from "@diffgazer/ui/lib/utils";
import type { ErrorComponentProps } from "@tanstack/react-router";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  ScriptOnce,
  Scripts,
  useRouter,
} from "@tanstack/react-router";
import { TanstackProvider } from "fumadocs-core/framework/tanstack";
import type { ReactNode } from "react";
import { GlobalNotFound } from "@/components/global-not-found";
import { TuiBracketLink } from "@/components/layout/tui-bracket-link";
import { TuiFaultPanel } from "@/components/layout/tui-fault-panel";
import { TuiShell } from "@/components/layout/tui-shell";
import { SearchDialog } from "@/features/search/components/dialog";
import { SearchProvider } from "@/hooks/search-context";
import { THEME_INIT_SCRIPT, ThemeProvider } from "@/hooks/theme-context";
import { DOCS_SHELL_CLASS } from "@/lib/docs-chrome";
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
  notFoundComponent: GlobalNotFound,
  errorComponent: RootErrorBoundary,
});

// Resolve the reader's theme (stored preference, else the dark default — docs are
// dark-first and deliberately ignore the OS scheme) and synchronize the SSR toggle as
// its markup is parsed, before either can paint with the stale dark fallback this
// shell has to serve.
function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    // suppressHydrationWarning: the bootstrap below stamps data-theme and colorScheme
    // on documentElement before hydration runs, so the client never finds the served
    // dark fallback here. next-themes' README mandates this same flag on <html> for
    // exactly this pre-paint pattern.
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        {/* ScriptOnce is TanStack's SSR-only inline-script helper, and the shape the
            shadcn TanStack Start dark-mode guide uses for this bootstrap. It stamps
            the per-request CSP nonce from router.options.ssr (server.ts) and appends
            document.currentScript.remove(), so the tag deletes itself the moment it
            runs; the client render is null and matches that emptied slot, which is
            why no suppressHydrationWarning is needed on the script itself.
            It stays ahead of HeadContent so the theme reaches documentElement before
            the stylesheet HeadContent emits can paint the served dark fallback. */}
        <ScriptOnce>{THEME_INIT_SCRIPT}</ScriptOnce>
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
          {/* Registers before the route subtree so a demo that mounts its own Toaster (the
              toast positions example) takes the top of the toaster stack and receives the toasts. */}
          <Toaster />
          <SearchProvider>
            <TuiShell>
              <Outlet />
            </TuiShell>
            <SearchDialog />
          </SearchProvider>
        </KeyboardProvider>
      </ThemeProvider>
    </TanstackProvider>
  );
}

function RootErrorBoundary({ error }: ErrorComponentProps) {
  const router = useRouter();

  return (
    <div className={cn(DOCS_SHELL_CLASS, "pb-[env(safe-area-inset-bottom)]")}>
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
