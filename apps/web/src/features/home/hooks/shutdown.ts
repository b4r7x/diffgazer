import { api } from "@/lib/api";

export async function shutdown() {
  try {
    await api.client.post("/shutdown", {});
  } catch {
    // Server terminates before responding
  }
  window.close();
}
