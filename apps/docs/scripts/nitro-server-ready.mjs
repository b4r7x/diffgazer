export const SERVER_READY_TIMEOUT_MS = 30_000;

export function describeExit({ code, signal }) {
  return signal ? `signal ${signal}` : `code ${code ?? "unknown"}`;
}

export function createNitroReadyWatcher(label) {
  function parseListeningOrigin(output) {
    const match = output.match(/Listening on:\s*http:\/\/127\.0\.0\.1:(\d+)\/?/);
    if (!match) return undefined;

    const port = Number(match[1]);
    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
      throw new Error(`${label} Nitro reported an invalid port: ${match[1]}`);
    }
    return `http://127.0.0.1:${port}`;
  }

  function waitForListeningOrigin(stdout, serverFailure, timeoutMs = SERVER_READY_TIMEOUT_MS) {
    return new Promise((resolveOrigin, reject) => {
      let output = "";

      const finish = (result) => {
        clearTimeout(timeout);
        stdout.off("data", onData);
        stdout.off("error", onError);
        if ("origin" in result) {
          resolveOrigin(result.origin);
          return;
        }
        reject(result.error);
      };

      const onData = (chunk) => {
        output += chunk.toString();
        try {
          const origin = parseListeningOrigin(output);
          if (origin) finish({ origin });
        } catch (error) {
          finish({ error });
        }
      };
      const onError = (error) => finish({ error });
      const timeout = setTimeout(
        () => finish({ error: new Error(`${label} Timed out waiting for Nitro to listen`) }),
        timeoutMs,
      );

      stdout.on("data", onData);
      stdout.on("error", onError);
      serverFailure.catch((error) => finish({ error }));
    });
  }

  return { parseListeningOrigin, waitForListeningOrigin };
}
