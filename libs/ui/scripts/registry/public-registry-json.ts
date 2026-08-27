export interface RegistryFileWithContent {
  content?: string;
  path?: string;
  type?: string;
  target?: string;
}

export interface PublicRegistryItemJson {
  name?: string;
  type?: string;
  registryDependencies?: string[];
  files?: RegistryFileWithContent[];
  meta?: { hidden?: boolean };
}

export interface PublicRegistryIndexJson {
  items?: PublicRegistryItemJson[];
}
