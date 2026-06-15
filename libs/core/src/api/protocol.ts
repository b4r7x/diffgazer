export const PROJECT_ROOT_HEADER = "x-diffgazer-project-root";
export const SHUTDOWN_TOKEN_HEADER = "x-diffgazer-shutdown-token";

export const SHUTDOWN_TOKEN_GLOBAL = "__DIFFGAZER_SHUTDOWN_TOKEN__";

declare global {
  interface Window {
    [SHUTDOWN_TOKEN_GLOBAL]?: string;
  }
}
