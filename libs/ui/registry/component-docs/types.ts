import type { ComponentDoc as RegistryComponentDoc } from "@diffgazer/registry"

export type {
  AnatomyNode,
  ComponentNote,
  KeyboardSection,
  ExampleRef,
  UsageSection,
} from "@diffgazer/registry"

/**
 * Public-component doc shape with a UI-only escape hatch.
 *
 * `noProps: true` declares that the component intentionally exposes no public
 * props (pure-visual primitives). `validate-registry-metadata.ts` requires every
 * public `registry:ui` item to either populate `props` or set `noProps: true`.
 */
export type ComponentDoc = RegistryComponentDoc & {
  noProps?: boolean
}
