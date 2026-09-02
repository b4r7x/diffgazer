import { getErrorMessage } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";

/**
 * Upper bound on a buffered upstream JSON response. A compromised upstream/proxy
 * returning a multi-hundred-MB body must be rejected before it is read into the
 * in-process CLI server's memory. The single source of truth for both model
 * fetchers — this cap is a security invariant that must not drift between them.
 */
export const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;

function responseTooLargeError(receivedBytes: number): Error {
  return new Error(
    `Upstream response too large: ${receivedBytes} bytes exceeds the ${MAX_RESPONSE_BYTES}-byte limit`,
  );
}

function cancelBodyBestEffort(cancel: () => Promise<unknown>): void {
  try {
    void cancel().catch(() => undefined);
  } catch {
    // Cancellation is advisory; the size-limit result must not depend on upstream cleanup.
  }
}

function wrapResponseBodyWithLimit(response: Response): Response {
  if (!response.body) return response;

  const reader = response.body.getReader();
  let receivedBytes = 0;
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const chunk = await reader.read();
        if (chunk.done) {
          controller.close();
          return;
        }

        receivedBytes += chunk.value.byteLength;
        if (receivedBytes > MAX_RESPONSE_BYTES) {
          const error = responseTooLargeError(receivedBytes);
          cancelBodyBestEffort(() => reader.cancel(error));
          controller.error(error);
          return;
        }
        controller.enqueue(chunk.value);
      } catch (error) {
        controller.error(error);
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

/** Adds the 16 MiB upstream-response ceiling to an SDK-compatible fetch function. */
export function createResponseLimitingFetch(
  fetcher: typeof fetch = globalThis.fetch,
): typeof fetch {
  return async (input, init) => {
    const response = await fetcher(input, init);
    const contentLength = response.headers.get("content-length");
    const declaredLength = contentLength === null ? null : Number(contentLength);
    if (
      declaredLength !== null &&
      Number.isFinite(declaredLength) &&
      declaredLength > MAX_RESPONSE_BYTES
    ) {
      const error = responseTooLargeError(declaredLength);
      const body = response.body;
      if (body) cancelBodyBestEffort(() => body.cancel(error));
      throw error;
    }
    return wrapResponseBodyWithLimit(response);
  };
}

/** Why a bounded response read stopped short of a complete body. */
export type ResponseReadFailure = Readonly<{
  code: "oversize-response" | "read-failed";
  message: string;
  /** The error that ended the read, for callers that classify by its code. */
  cause?: unknown;
}>;

/**
 * Read a fetch response as text with a hard byte ceiling: reject on a declared
 * Content-Length over the cap, otherwise stream the body and cancel it the
 * moment the received bytes exceed the cap, so an oversized upstream body is
 * never fully buffered. `label` names the upstream in error messages.
 */
const declaredLengthOverLimit = (
  response: Response,
  maxBytes: number,
  label: string,
): ResponseReadFailure | null => {
  const declaredLength = Number(response.headers?.get?.("content-length"));
  if (!Number.isFinite(declaredLength) || declaredLength <= maxBytes) {
    return null;
  }
  const body = response.body;
  if (body) cancelBodyBestEffort(() => body.cancel(`${label} response exceeded the size limit`));
  return {
    code: "oversize-response",
    message: `${label} response too large: ${declaredLength} bytes`,
  };
};

export const readTextResponseWithLimit = async (
  response: Response,
  maxBytes: number,
  label: string,
): Promise<Result<string, ResponseReadFailure>> => {
  const declared = declaredLengthOverLimit(response, maxBytes, label);
  if (declared) {
    return err(declared);
  }

  if (!response.body) {
    try {
      const text = await response.text();
      if (new TextEncoder().encode(text).byteLength > maxBytes) {
        return err({ code: "oversize-response", message: `${label} response too large` });
      }
      return ok(text);
    } catch (error) {
      return err({
        code: "read-failed",
        message: getErrorMessage(error, `Failed to read ${label} response`),
        cause: error,
      });
    }
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let receivedBytes = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      receivedBytes += value.byteLength;
      if (receivedBytes > maxBytes) {
        cancelBodyBestEffort(() => reader.cancel(`${label} response exceeded the size limit`));
        return err({
          code: "oversize-response",
          message: `${label} response too large: ${receivedBytes} bytes`,
        });
      }

      text += decoder.decode(value, { stream: true });
    }

    text += decoder.decode();
  } catch (error) {
    cancelBodyBestEffort(() => reader.cancel(`${label} response read failed`));
    return err({
      code: "read-failed",
      message: getErrorMessage(error, `Failed to read ${label} response`),
      cause: error,
    });
  }

  return ok(text);
};

/**
 * Releases a response body the caller has decided not to read. Without it the
 * wrapper stream from `createResponseLimitingFetch` — and the socket behind it —
 * stay alive until garbage collection.
 */
export const cancelResponseBody = (response: Response): void => {
  const body = response.body;
  if (!body) return;
  cancelBodyBestEffort(() => body.cancel("Response body abandoned"));
};

/**
 * Read a fetch response as JSON with the 16 MiB upstream ceiling. `label` names
 * the upstream in error messages (e.g. "OpenRouter models", "models.dev catalog").
 */
export const readJsonResponseWithLimit = async (
  response: Response,
  label: string,
): Promise<Result<unknown, { message: string }>> => {
  const declared = declaredLengthOverLimit(response, MAX_RESPONSE_BYTES, label);
  if (declared) {
    return err({ message: declared.message });
  }

  if (!response.body) {
    try {
      return ok((await response.json()) as unknown);
    } catch (error) {
      return err({ message: getErrorMessage(error, `${label} response was not JSON`) });
    }
  }

  const text = await readTextResponseWithLimit(response, MAX_RESPONSE_BYTES, label);
  if (!text.ok) {
    return err({ message: text.error.message });
  }

  try {
    return ok(JSON.parse(text.value) as unknown);
  } catch (error) {
    return err({ message: getErrorMessage(error, `${label} response was not JSON`) });
  }
};
