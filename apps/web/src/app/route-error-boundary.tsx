import { BACK_SHORTCUT } from "@diffgazer/core/schemas/presentation";
import { Button } from "@diffgazer/ui/components/button";
import { Typography } from "@diffgazer/ui/components/typography";
import { type ErrorComponentProps, Outlet, useNavigate, useRouter } from "@tanstack/react-router";
import { FailureView } from "@/components/shared/failure-view";
import { RouteModuleImportError } from "./route-import";

function RootRouteRecoveryPage({ error, onRetry }: { error: Error; onRetry: () => void }) {
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
      <Button variant="secondary" onClick={onRetry}>
        Try again
      </Button>
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
      footerRightShortcuts={[BACK_SHORTCUT, { key: "Esc", label: "Home" }]}
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
