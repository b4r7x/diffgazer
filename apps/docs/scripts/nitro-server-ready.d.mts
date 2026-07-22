import type { Readable } from "node:stream";

export const SERVER_READY_TIMEOUT_MS: number;

export function describeExit(exit: { code: number | null; signal: NodeJS.Signals | null }): string;

export interface NitroReadyWatcher {
  parseListeningOrigin(output: string): string | undefined;
  waitForListeningOrigin(
    stdout: Readable,
    serverFailure: Promise<never>,
    timeoutMs?: number,
  ): Promise<string>;
}

export function createNitroReadyWatcher(label: string): NitroReadyWatcher;
