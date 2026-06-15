import { getErrorMessage } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";

/**
 * Upper bound on a buffered upstream JSON response. A compromised upstream/proxy
 * returning a multi-hundred-MB body must be rejected before it is read into the
 * in-process CLI server's memory. The single source of truth for both model
 * fetchers — this cap is a security invariant that must not drift between them.
 */
export const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;

/**
 * Read a fetch response as JSON with a hard byte ceiling: reject on a declared
 * Content-Length over the cap, otherwise stream the body and abort once the
 * received bytes exceed it. `label` names the upstream in error messages
 * (e.g. "OpenRouter models", "models.dev catalog").
 */
export const readJsonResponseWithLimit = async (
  response: Response,
  label: string,
): Promise<Result<unknown, { message: string }>> => {
  const declaredLength = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    return err({ message: `${label} response too large: ${declaredLength} bytes` });
  }

  if (!response.body) {
    try {
      return ok((await response.json()) as unknown);
    } catch (error) {
      return err({ message: getErrorMessage(error, `${label} response was not JSON`) });
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
      if (receivedBytes > MAX_RESPONSE_BYTES) {
        await reader.cancel(`${label} response exceeded the size limit`);
        return err({ message: `${label} response too large: ${receivedBytes} bytes` });
      }

      text += decoder.decode(value, { stream: true });
    }

    text += decoder.decode();
  } catch (error) {
    return err({ message: getErrorMessage(error, `Failed to read ${label} response`) });
  }

  try {
    return ok(JSON.parse(text) as unknown);
  } catch (error) {
    return err({ message: getErrorMessage(error, `${label} response was not JSON`) });
  }
};
