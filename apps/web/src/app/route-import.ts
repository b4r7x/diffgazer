import { type ComponentType, lazy } from "react";

export class RouteModuleImportError extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : "Route module failed to load", { cause });
    this.name = "RouteModuleImportError";
  }
}

export function lazyRoute<T extends ComponentType>(load: () => Promise<{ default: T }>) {
  return lazy(() =>
    load().catch((cause: unknown) => {
      throw new RouteModuleImportError(cause);
    }),
  );
}
