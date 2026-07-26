import { PassThrough, Writable } from "node:stream";

export class TestOutput extends Writable {
  readonly frames: string[] = [];
  readonly isTTY = true;

  constructor(
    readonly columns: number,
    readonly rows: number,
  ) {
    super();
  }

  override _write(
    chunk: string | Buffer,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    this.frames.push(chunk.toString());
    callback();
  }
}

export class TestInput extends PassThrough {
  readonly isTTY = true;

  setRawMode(): this {
    return this;
  }

  ref(): this {
    return this;
  }

  unref(): this {
    return this;
  }
}
