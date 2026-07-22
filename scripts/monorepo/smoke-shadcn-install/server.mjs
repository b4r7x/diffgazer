import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import { registryRouteFromUrl } from "./registry.mjs";

function rewriteRegistryUrls(value, baseUrl) {
  if (typeof value === "string") {
    const route = registryRouteFromUrl(value);
    return route ? `${baseUrl}${route}` : value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => rewriteRegistryUrls(item, baseUrl));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, rewriteRegistryUrls(item, baseUrl)]),
    );
  }
  return value;
}

export function createRegistryHandler(registryDirs, getBaseUrl) {
  return (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const pathParts = url.pathname.split("/").filter(Boolean);
      const namespace = pathParts[0] === "r" ? pathParts[1] : pathParts[0];
      const fileName = pathParts[0] === "r" ? pathParts[2] : pathParts[1];
      const registryDir = registryDirs.get(namespace);

      if (!registryDir || !fileName || !/^(registry|[a-z0-9-]+)\.json$/.test(fileName)) {
        response.writeHead(404).end();
        return;
      }

      const filePath = join(registryDir, fileName);
      if (!existsSync(filePath)) {
        response.writeHead(404).end();
        return;
      }

      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      const json = JSON.parse(readFileSync(filePath, "utf-8"));
      response.end(JSON.stringify(rewriteRegistryUrls(json, getBaseUrl()), null, 2));
    } catch (error) {
      response.writeHead(500).end(error instanceof Error ? error.message : String(error));
    }
  };
}

export function startRegistryServer(uiRegistryDir, keysRegistryDir) {
  const registryDirs = new Map([
    ["ui", uiRegistryDir],
    ["keys", keysRegistryDir],
  ]);
  let baseUrl = "";
  const server = createServer(createRegistryHandler(registryDirs, () => baseUrl));

  return new Promise((resolveServer, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not determine local registry server address"));
        return;
      }
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolveServer({
        baseUrl,
        close: () =>
          new Promise((resolveClose, rejectClose) => {
            server.close((error) => (error ? rejectClose(error) : resolveClose()));
          }),
      });
    });
  });
}
