"use client";

import { createContext, type ReactNode, useContext } from "react";

export const PENDING_PORTAL_CONTAINER = Symbol("PENDING_PORTAL_CONTAINER");

export type PortalContainerValue = Element | typeof PENDING_PORTAL_CONTAINER;

const PortalContainerContext = createContext<PortalContainerValue | undefined>(undefined);

export function usePortalContainer() {
  return useContext(PortalContainerContext);
}

export function isPendingPortalContainer(value: unknown): value is typeof PENDING_PORTAL_CONTAINER {
  return value === PENDING_PORTAL_CONTAINER;
}

export function PortalContainerProvider({
  container,
  children,
}: {
  container: Element | null;
  children: ReactNode;
}) {
  return (
    <PortalContainerContext value={container ?? PENDING_PORTAL_CONTAINER}>
      {children}
    </PortalContainerContext>
  );
}
