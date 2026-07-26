import { EventEmitter } from "node:events";
import { vi } from "vitest";

export interface FakeChild extends Promise<unknown> {
  stdout: EventEmitter;
  stderr: EventEmitter;
  kill: ReturnType<typeof vi.fn>;
  pid: number;
}

export function createFakeChild(): FakeChild {
  const pending = new Promise<unknown>(() => {}) as FakeChild;
  pending.stdout = new EventEmitter();
  pending.stderr = new EventEmitter();
  pending.kill = vi.fn();
  pending.pid = 4321;
  return pending;
}

export function createSettlingFakeChild(): FakeChild {
  let resolveChild = () => {};
  const child = new Promise<void>((resolve) => {
    resolveChild = resolve;
  }) as FakeChild;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = vi.fn(() => resolveChild());
  child.pid = 4321;
  return child;
}

export function createResolvableFakeChild(): { child: FakeChild; resolve: () => void } {
  let resolveChild = () => {};
  const child = new Promise<void>((resolve) => {
    resolveChild = resolve;
  }) as FakeChild;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = vi.fn();
  child.pid = 4321;
  return { child, resolve: resolveChild };
}

export const BASE_CONFIG = {
  command: "node",
  args: ["server.js"],
  cwd: "/srv",
  port: 5000,
  readyPattern: "ready",
};

export const VITE_READY_LINE = "  ➜  Local:   http://localhost:3002/\n";
export const VITE_MARKER_START = VITE_READY_LINE.indexOf("Local:");
export const VITE_URL_START = VITE_READY_LINE.indexOf("http://");
export const VITE_SPLIT_BOUNDARIES = Array.from(
  { length: VITE_URL_START - VITE_MARKER_START },
  (_, index) => VITE_MARKER_START + index + 1,
);
