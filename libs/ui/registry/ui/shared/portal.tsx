"use client";

import { type ReactNode, type RefObject, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  isPendingPortalContainer,
  type PortalContainerValue,
  usePortalContainer,
} from "./portal-context";

/** Props for portal. */
export interface PortalProps {
  /** Content rendered inside the component. */
  children: ReactNode;
  /** Portal container element. */
  container?: PortalContainerValue | null;
}

export function useAriaLinkedPortalContainer(
  container: Element | null | undefined,
  triggerRef: RefObject<Element | null>,
): Element | null | undefined {
  const [triggerDocument, setTriggerDocument] = useState<Document | null>(
    () => triggerRef.current?.ownerDocument ?? null,
  );

  useLayoutEffect(() => {
    const nextDocument = triggerRef.current?.ownerDocument ?? null;
    setTriggerDocument((current) => (current === nextDocument ? current : nextDocument));
  });

  const isCrossDocument =
    container !== null &&
    container !== undefined &&
    triggerDocument !== null &&
    container.ownerDocument !== triggerDocument;

  return isCrossDocument ? triggerDocument.body : container;
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
  // Reached only when neither a container prop nor a scoped container is present.
  let target: PortalContainerValue | null = typeof document !== "undefined" ? document.body : null;
  if (container !== undefined) {
    target = container;
  } else if (scopedContainer !== undefined) {
    target = scopedContainer;
  }

  if (!target || isPendingPortalContainer(target)) return null;
  return createPortal(children, target);
}
