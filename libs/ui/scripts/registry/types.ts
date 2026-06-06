export interface RegistryFile {
  path: string;
  type?: string;
  target?: string;
}

export interface RegistryItem {
  name: string;
  type: string;
  files: RegistryFile[];
  dependencies?: string[];
  registryDependencies?: string[];
  meta?: {
    client?: boolean;
    hidden?: boolean;
    optionalIntegrations?: string[];
  };
}

export interface Registry {
  items: RegistryItem[];
}
