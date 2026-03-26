import type { ReactNode } from "react";

export function webLoading(label: string): () => ReactNode {
  return () => (
    <div className="flex flex-col flex-1 items-center justify-center text-tui-muted">
      <span>{label}</span>
    </div>
  );
}

export function webError(): (err: Error) => ReactNode {
  return (err: Error) => (
    <div className="flex flex-col flex-1 items-center justify-center text-tui-red">
      <span>Error: {err.message}</span>
    </div>
  );
}
