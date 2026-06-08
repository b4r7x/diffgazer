import { lazy } from "react"
import type { ComponentType, LazyExoticComponent } from "react"

export const demos: Record<string, LazyExoticComponent<ComponentType>> = {
  "use-action-row-navigation-basic": lazy(() => import("../../registry/examples/use-action-row-navigation/use-action-row-navigation-basic")),
  "use-focus-restore-basic": lazy(() => import("../../registry/examples/use-focus-restore/use-focus-restore-basic")),
  "use-focus-restore-fallback": lazy(() => import("../../registry/examples/use-focus-restore/use-focus-restore-fallback")),
  "use-focus-trap-basic": lazy(() => import("../../registry/examples/use-focus-trap/use-focus-trap-basic")),
  "use-focus-trap-initial-focus": lazy(() => import("../../registry/examples/use-focus-trap/use-focus-trap-initial-focus")),
  "use-focus-zone-basic": lazy(() => import("../../registry/examples/use-focus-zone/use-focus-zone-basic")),
  "use-focus-zone-tab-cycle": lazy(() => import("../../registry/examples/use-focus-zone/use-focus-zone-tab-cycle")),
  "use-key-basic": lazy(() => import("../../registry/examples/use-key/use-key-basic")),
  "use-key-map": lazy(() => import("../../registry/examples/use-key/use-key-map")),
  "use-key-scoped": lazy(() => import("../../registry/examples/use-key/use-key-scoped")),
  "use-navigation-basic": lazy(() => import("../../registry/examples/use-navigation/use-navigation-basic")),
  "use-navigation-tabs": lazy(() => import("../../registry/examples/use-navigation/use-navigation-tabs")),
  "use-scope-basic": lazy(() => import("../../registry/examples/use-scope/use-scope-basic")),
  "use-scope-nested": lazy(() => import("../../registry/examples/use-scope/use-scope-nested")),
  "use-scoped-navigation-basic": lazy(() => import("../../registry/examples/use-scoped-navigation/use-scoped-navigation-basic")),
  "use-scoped-navigation-focus-within": lazy(() => import("../../registry/examples/use-scoped-navigation/use-scoped-navigation-focus-within")),
  "use-scroll-lock-basic": lazy(() => import("../../registry/examples/use-scroll-lock/use-scroll-lock-basic")),
  "use-scroll-lock-target": lazy(() => import("../../registry/examples/use-scroll-lock/use-scroll-lock-target")),
}
