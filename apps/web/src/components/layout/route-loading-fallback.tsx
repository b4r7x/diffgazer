import { Spinner } from "@diffgazer/ui/components/spinner";

export function RouteLoadingFallback() {
  return (
    <div className="flex flex-1 items-center justify-center bg-tui-bg text-tui-fg font-mono">
      <Spinner size="md" className="text-tui-muted">
        Loading...
      </Spinner>
    </div>
  );
}
