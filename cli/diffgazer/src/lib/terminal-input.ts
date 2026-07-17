import type { Readable } from "node:stream";

const ESCAPE = "\u001b";
const PASTE_START = "\u001b[200~";
const PASTE_END = "\u001b[201~";
const ESCAPE_PREFIX_HOLD_MS = 50;

export type TerminalInputClassification = "ordinary" | "legacy-modified";

export interface TerminalInputQueue {
  consume(): TerminalInputClassification | undefined;
}

interface TerminalInputSource extends Readable {
  readonly isTTY: boolean;
  setRawMode(value: boolean): unknown;
  ref(): unknown;
  unref(): unknown;
}

interface ParsedEscape {
  classification: TerminalInputClassification;
  nextIndex: number;
}

type EscapeParseResult = ParsedEscape | "pending";

interface InputClassifier extends TerminalInputQueue {
  push(chunk: unknown): void;
  reset(): void;
}

export interface TerminalInputBoundary {
  readonly stdin: NodeJS.ReadStream;
  readonly queue: TerminalInputQueue;
  dispose(): void;
}

function isCsiParameterByte(byte: number): boolean {
  return byte >= 0x30 && byte <= 0x3f;
}

function isCsiIntermediateByte(byte: number): boolean {
  return byte >= 0x20 && byte <= 0x2f;
}

function isCsiFinalByte(byte: number): boolean {
  return byte >= 0x40 && byte <= 0x7e;
}

function parseControlSequence(
  input: string,
  startIndex: number,
  prefixLength: number,
): number | "pending" | undefined {
  const sequenceType = input[startIndex + prefixLength];
  if (sequenceType === undefined) return "pending";

  if (sequenceType === "O") {
    const nextIndex = startIndex + prefixLength + 2;
    if (nextIndex > input.length) return "pending";

    const finalByte = input.codePointAt(nextIndex - 1);
    return finalByte !== undefined && isCsiFinalByte(finalByte) ? nextIndex : undefined;
  }

  if (sequenceType !== "[") return undefined;

  const payloadStart = startIndex + prefixLength + 1;
  for (let index = payloadStart; index < input.length; index++) {
    const byte = input.codePointAt(index);
    if (byte === undefined) return "pending";
    if (isCsiParameterByte(byte) || isCsiIntermediateByte(byte)) continue;
    if (byte === 0x5b && index === payloadStart) continue;
    return isCsiFinalByte(byte) ? index + 1 : undefined;
  }

  return "pending";
}

function parseEscape(input: string, startIndex: number): EscapeParseResult {
  if (startIndex === input.length - 1) return "pending";

  const next = input[startIndex + 1];
  if (next === ESCAPE) {
    if (startIndex + 2 >= input.length) return "pending";

    const controlEnd = parseControlSequence(input, startIndex, 2);
    if (controlEnd === "pending") return "pending";
    return {
      classification: "ordinary",
      nextIndex: controlEnd ?? startIndex + 2,
    };
  }

  const controlEnd = parseControlSequence(input, startIndex, 1);
  if (controlEnd === "pending") return "pending";
  if (controlEnd !== undefined) {
    const sequence = input.slice(startIndex, controlEnd);
    if (sequence === PASTE_START) {
      const pasteEnd = input.indexOf(PASTE_END, controlEnd);
      if (pasteEnd === -1) return "pending";
      return {
        classification: "ordinary",
        nextIndex: pasteEnd + PASTE_END.length,
      };
    }

    return { classification: "ordinary", nextIndex: controlEnd };
  }

  const codePoint = input.codePointAt(startIndex + 1);
  if (codePoint === undefined) return "pending";

  return {
    classification: codePoint >= 0x20 && codePoint !== 0x7f ? "legacy-modified" : "ordinary",
    nextIndex: startIndex + 1 + (codePoint > 0xff_ff ? 2 : 1),
  };
}

function enqueuePlainEvents(input: string, classifications: TerminalInputClassification[]): void {
  let segmentStart = 0;

  for (let index = 0; index < input.length; index++) {
    const character = input[index];
    if (character !== "\u007f" && character !== "\u0008") continue;

    if (index > segmentStart) classifications.push("ordinary");
    classifications.push("ordinary");
    segmentStart = index + 1;
  }

  if (segmentStart < input.length) classifications.push("ordinary");
}

function toInputText(chunk: unknown): string | undefined {
  if (typeof chunk === "string") return chunk;
  if (chunk instanceof Uint8Array) return Buffer.from(chunk).toString("utf8");
  return undefined;
}

function createInputClassifier(): InputClassifier {
  const classifications: TerminalInputClassification[] = [];
  let pending = "";

  return {
    consume() {
      const classification = classifications.shift();
      if (classification === undefined) pending = "";
      return classification;
    },
    push(chunk) {
      const text = toInputText(chunk);
      if (text === undefined) return;

      const input = pending + text;
      pending = "";
      let index = 0;

      while (index < input.length) {
        const escapeIndex = input.indexOf(ESCAPE, index);
        if (escapeIndex === -1) {
          enqueuePlainEvents(input.slice(index), classifications);
          break;
        }

        if (escapeIndex > index) {
          enqueuePlainEvents(input.slice(index, escapeIndex), classifications);
        }

        const parsed = parseEscape(input, escapeIndex);
        if (parsed === "pending") {
          pending = input.slice(escapeIndex);
          break;
        }

        classifications.push(parsed.classification);
        index = parsed.nextIndex;
      }
    },
    reset() {
      classifications.length = 0;
      pending = "";
    },
  };
}

export function createTerminalInputBoundary(source: TerminalInputSource): TerminalInputBoundary {
  let isDisposed = false;
  let heldEscape = false;
  let heldEscapeTimer: ReturnType<typeof setTimeout> | undefined;
  const releasedInput: unknown[] = [];
  const classifier = createInputClassifier();

  const clearHeldEscapeTimer = () => {
    if (heldEscapeTimer === undefined) return;
    clearTimeout(heldEscapeTimer);
    heldEscapeTimer = undefined;
  };

  const releaseHeldEscape = () => {
    clearHeldEscapeTimer();
    if (!heldEscape) return;

    heldEscape = false;
    classifier.push(ESCAPE);
    releasedInput.push(ESCAPE);
    source.emit("readable");
  };

  const read = (size?: number): unknown => {
    const released = releasedInput.shift();
    if (released !== undefined) return released;

    const chunk: unknown = source.read(size);
    if (isDisposed || chunk === null) return chunk;

    const text = toInputText(chunk);
    if (heldEscape) {
      clearHeldEscapeTimer();
      heldEscape = false;

      if (text !== undefined) {
        const combined = ESCAPE + text;
        classifier.push(combined);
        return combined;
      }

      classifier.push(ESCAPE);
      classifier.push(chunk);
      releasedInput.push(chunk);
      return ESCAPE;
    }

    if (text === ESCAPE) {
      heldEscape = true;
      heldEscapeTimer = setTimeout(releaseHeldEscape, ESCAPE_PREFIX_HOLD_MS);
      heldEscapeTimer.unref?.();
      return null;
    }

    classifier.push(chunk);
    return chunk;
  };

  const stdin = new Proxy(source, {
    get(target, property) {
      if (property === "read") return read;

      const value: unknown = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as NodeJS.ReadStream;

  return {
    stdin,
    queue: classifier,
    dispose() {
      releaseHeldEscape();
      isDisposed = true;
      classifier.reset();
    },
  };
}
