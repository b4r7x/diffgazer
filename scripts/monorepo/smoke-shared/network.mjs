import { ENV } from "../lib/env.mjs";

export function networkAllowed() {
  return process.env[ENV.smokeAllowNetwork] === "1";
}

export async function fetchJsonWithLimit(url, { fetchImpl = fetch, label, maxBytes, signal }) {
  const response = await fetchImpl(url, { redirect: "error", signal });
  if (!response.ok) throw new Error(`${label}: HTTP ${response.status}`);

  const declaredLength = response.headers.get("content-length")?.trim();
  if (declaredLength && /^\d+$/.test(declaredLength)) {
    const declaredBytes = Number(declaredLength);
    if (!Number.isSafeInteger(declaredBytes) || declaredBytes > maxBytes) {
      throw new Error(`${label}: response exceeds ${maxBytes} bytes`);
    }
  }

  if (!response.body) throw new Error(`${label}: response body is empty`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let receivedBytes = 0;
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    receivedBytes += value.byteLength;
    if (receivedBytes > maxBytes) {
      const message = `${label}: response exceeds ${maxBytes} bytes`;
      await reader.cancel(message);
      throw new Error(message);
    }
    text += decoder.decode(value, { stream: true });
  }

  text += decoder.decode();
  return JSON.parse(text);
}
