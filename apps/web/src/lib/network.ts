/** Default host for local server */
export const DEFAULT_HOST = "127.0.0.1";

/** Default port for CLI server */
export const DEFAULT_PORT = "3000";

/** Default port for web UI API server */
const WEB_API_PORT = 3000;

/** Build the default API URL for web UI */
export function getDefaultApiUrl(): string {
  return `http://${DEFAULT_HOST}:${WEB_API_PORT}`;
}
