import { lazy } from "react"
import type { ComponentType, LazyExoticComponent } from "react"

export const demos: Record<string, LazyExoticComponent<ComponentType>> = {
  "use-focus-trap-basic": lazy(() => import("../../../registry/examples/keys/use-focus-trap/use-focus-trap-basic")),
  "use-focus-zone-basic": lazy(() => import("../../../registry/examples/keys/use-focus-zone/use-focus-zone-basic")),
  "use-key-basic": lazy(() => import("../../../registry/examples/keys/use-key/use-key-basic")),
  "use-key-map": lazy(() => import("../../../registry/examples/keys/use-key/use-key-map")),
  "use-navigation-basic": lazy(() => import("../../../registry/examples/keys/use-navigation/use-navigation-basic")),
  "use-navigation-tabs": lazy(() => import("../../../registry/examples/keys/use-navigation/use-navigation-tabs")),
  "use-scope-basic": lazy(() => import("../../../registry/examples/keys/use-scope/use-scope-basic")),
  "use-scoped-navigation-basic": lazy(() => import("../../../registry/examples/keys/use-scoped-navigation/use-scoped-navigation-basic")),
  "use-scroll-lock-basic": lazy(() => import("../../../registry/examples/keys/use-scroll-lock/use-scroll-lock-basic")),
}
