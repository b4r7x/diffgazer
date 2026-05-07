"use client";

import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { isPendingPortalContainer, usePortalContainer, type PortalContainerValue } from "./portal-context";

export interface PortalProps {
  children: ReactNode;
  container?: PortalContainerValue | null;
}

export function Portal({ children, container }: PortalProps) {
  const scopedContainer = usePortalContainer();
  const target = container !== undefined
    ? container
    : scopedContainer !== undefined
      ? scopedContainer
      : typeof document !== "undefined"
        ? document.body
        : null;

  if (!target || isPendingPortalContainer(target)) return null;
  return createPortal(children, target);
}
