export function parsePort(value: string): number {
  const port = parseInt(value, 10);

  if (Number.isNaN(port) || port < 1 || port > 65535) {
    throw new Error("Invalid port number");
  }

  return port;
}
