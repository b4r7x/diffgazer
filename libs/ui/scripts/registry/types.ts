import type {
  Registry as CanonicalRegistry,
  RegistryItem as CanonicalRegistryItem,
  RegistryFile,
} from "@diffgazer/registry/schemas";
import { RegistrySchema } from "@diffgazer/registry/schemas";

type UiRegistryMeta = {
  client?: boolean;
  hidden?: boolean;
  optionalIntegrations?: string[];
  docsPage?: boolean;
  crossDeps?: unknown;
};

export const UiRegistrySchema = RegistrySchema;

export type { RegistryFile };
export type RegistryItem = Omit<
  CanonicalRegistryItem,
  "dependencies" | "registryDependencies" | "meta"
> & {
  dependencies?: string[];
  registryDependencies?: string[];
  meta?: CanonicalRegistryItem["meta"] & UiRegistryMeta;
};
export type Registry = Omit<CanonicalRegistry, "items"> & {
  $schema?: string;
  items: RegistryItem[];
};
