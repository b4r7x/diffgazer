export interface SystemDiagnostics {
  version: string;
  nodeVersion: string;
  tty: boolean;
  terminalSize: string;
  colorSupport: string;
  unicodeSupport: string;
  memoryRss: string;
  memoryHeap: string;
  paths: {
    config: string;
    data: string;
    cache: string;
  };
}
