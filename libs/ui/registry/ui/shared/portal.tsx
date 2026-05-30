"use client";

import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { isPendingPortalContainer, usePortalContainer, type PortalContainerValue } from "./portal-context";

export interface PortalProps {
  children: ReactNode;
  container?: PortalContainerValue | null;
}

/**
 * `Portal` resolves its target in priority order:
 *   1. explicit `container` prop (caller-owned, may target any document)
 *   2. scoped container from `PortalContainerProvider` (carries the document of the surrounding overlay)
 *   3. ambient `document.body` fallback
 *
 * Cross-document callers (iframe overlays, popovers from a different document)
 * should pass `container` directly or wrap consumers in a `PortalContainerProvider`
 * so the portal target shares its ownerDocument with the surrounding tree.
 *
 * SSR/hydration: this is a client component. When no DOM document exists (server
 * render) it renders nothing, so the server HTML carries no portal content. That
 * is hydration-safe because portaled children never occupy a host position inside
 * the hydrated tree — on the client they mount into the resolved target without a
 * mismatch. Consumers needing server-rendered overlay content must render outside
 * a Portal.
 */
export function Portal({ children, container }: PortalProps) {
  const scopedContainer = usePortalContainer();
  const fallback = scopedContainer !== undefined && !isPendingPortalContainer(scopedContainer)
    ? scopedContainer.ownerDocument.body
    : typeof document !== "undefined"
      ? document.body
      : null;
  const target = container !== undefined
    ? container
    : scopedContainer !== undefined
      ? scopedContainer
      : fallback;

  if (!target || isPendingPortalContainer(target)) return null;
  return createPortal(children, target);
}
