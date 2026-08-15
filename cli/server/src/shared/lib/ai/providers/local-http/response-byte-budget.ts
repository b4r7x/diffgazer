import { err, ok, type Result } from "@diffgazer/core/result";

export type AdmittedResponseByteBudget = Readonly<{
  consumed: () => number;
  requestLimit: () => number;
  recordText: (text: string) => Result<void, "oversize-response">;
}>;

/** Tracks cumulative response bytes against one admitted maxResponseBytes envelope. */
export function createAdmittedResponseByteBudget(
  maxResponseBytes: number,
): AdmittedResponseByteBudget {
  let consumed = 0;

  return Object.freeze({
    consumed: () => consumed,
    requestLimit: () => Math.max(0, maxResponseBytes - consumed),
    recordText: (text: string): Result<void, "oversize-response"> => {
      const bytes = new TextEncoder().encode(text).byteLength;
      if (consumed + bytes > maxResponseBytes) {
        return err("oversize-response");
      }
      consumed += bytes;
      return ok(undefined);
    },
  });
}
