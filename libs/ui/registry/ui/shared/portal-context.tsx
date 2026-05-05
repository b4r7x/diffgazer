"use client";

import { createContext, useContext, type ReactNode } from "react";

const PortalContainerContext = createContext<Element | null>(null);

export function usePortalContainer() {
  return useContext(PortalContainerContext);
}

export function PortalContainerProvider({
  container,
  children,
}: {
  container: Element | null;
  children: ReactNode;
}) {
  return (
    <PortalContainerContext value={container}>
      {children}
    </PortalContainerContext>
  );
}
