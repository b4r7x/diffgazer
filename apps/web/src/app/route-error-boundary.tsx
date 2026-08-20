import { useKey } from "@diffgazer/keys";
import { Button } from "@diffgazer/ui/components/button";
import { Kbd } from "@diffgazer/ui/components/kbd";
import { Typography } from "@diffgazer/ui/components/typography";
import { type ErrorComponentProps, Outlet, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { FailureView } from "@/components/shared/failure-view";
import { RouteModuleImportError } from "./route-import";

function RootRouteRecoveryPage({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const retryRef = useRef<HTMLButtonElement>(null);

  useKey("r", onRetry);

  // The root gate renders outside the shell with a single control; focus lands
  // on it so Enter retries.
  useEffect(() => {
    retryRef.current?.focus();
  }, []);

  return (
    <div className="flex h-dvh flex-col items-center justify-center space-y-4 bg-background px-4 text-foreground">
      <div role="alert">
        <Typography as="h1" size="2xl" className="text-error-text">
          Something went wrong
        </Typography>
      </div>
      {import.meta.env.DEV ? (
        <p className="max-w-prose text-center font-mono text-sm text-muted-foreground">
          {error.message}
        </p>
      ) : null}
      <Button ref={retryRef} variant="secondary" onClick={onRetry}>
        Try again
      </Button>
      <p className="text-xs text-muted-foreground font-mono">
        <Kbd size="sm">r</Kbd> try again
      </p>
    </div>
  );
}

export function RouteRecoveryPage({
  error,
  reloadDocument = () => window.location.reload(),
  clearFooter = true,
}: ErrorComponentProps & { reloadDocument?: () => void; clearFooter?: boolean }) {
  const router = useRouter();
  const navigate = useNavigate();
  const handleRetry = () => {
    if (error instanceof RouteModuleImportError) {
      reloadDocument();
      return;
    }
    void router.invalidate().catch(() => {});
  };

  if (!clearFooter) {
    return <RootRouteRecoveryPage error={error} onRetry={handleRetry} />;
  }

  return (
    <FailureView
      title="Something went wrong"
      message={
        import.meta.env.DEV ? error.message : "The page failed to load. Try again or return home."
      }
      scope="route-error"
      primary={{ label: "Try again", onAction: handleRetry }}
      secondary={{ label: "Go to Home", onAction: () => void navigate({ to: "/" }) }}
      footerRightShortcuts={[{ key: "Esc", label: "Home" }]}
    />
  );
}

export function RouteOutletBoundary() {
  return (
    <div className="flex flex-1 flex-col min-h-0">
      <Outlet />
    </div>
  );
}
