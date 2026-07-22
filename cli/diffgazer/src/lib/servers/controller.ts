export interface ServerController {
  start: () => Promise<void>;
  stop: () => Promise<void>;
}
