import type { ComponentDoc as RegistryComponentDoc } from "@diffgazer/registry";

/**
 * Public-component doc shape with a UI-only escape hatch.
 *
 * `noProps: true` declares that the component intentionally exposes no public
 * props (pure-visual primitives). `validate-registry-metadata.ts` requires every
 * public `registry:ui` item to either populate `props` or set `noProps: true`.
 */
type ExampleRef = NonNullable<RegistryComponentDoc["examples"]>[number] & {
  /** Registry items used only by this example, not by the owning primitive. */
  registryDependencies?: string[];
  /** Optional integration modes needed only when this example is copied. */
  optionalIntegrations?: string[];
};

export type ComponentDoc = Omit<RegistryComponentDoc, "examples"> & {
  examples?: ExampleRef[];
  noProps?: boolean;
};
