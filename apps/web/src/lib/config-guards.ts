import { configQueries } from "@diffgazer/core/api/hooks";
import { isRedirect, redirect } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/query-client";

async function fetchConfigured(): Promise<boolean> {
  const init = await queryClient.ensureQueryData(configQueries.init(api));
  return init.setup.isConfigured;
}

export async function requireConfigured() {
  try {
    const configured = await fetchConfigured();
    if (!configured) throw redirect({ to: "/onboarding" });
  } catch (e) {
    if (isRedirect(e)) throw e;
    // Transient API failures must not redirect; let the guarded route render.
  }
}

export async function requireNotConfigured() {
  try {
    const configured = await fetchConfigured();
    if (configured) throw redirect({ to: "/" });
  } catch (e) {
    if (isRedirect(e)) throw e;
    // Transient API failures must not redirect away from onboarding.
  }
}
