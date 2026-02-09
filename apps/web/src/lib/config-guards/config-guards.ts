import { redirect } from "@tanstack/react-router";
import { api } from "@/lib/api";
import {
  getConfiguredGuardCache,
  setConfiguredGuardCache,
} from "./config-guard-cache";

export const CONFIG_CACHE_TTL = 30_000;

function isRedirectError(error: unknown): error is { to: string } {
  if (error === null || typeof error !== "object") return false;
  if ("to" in error) return true;
  if ("options" in error) {
    const options = (error as { options?: { to?: unknown } }).options;
    return typeof options?.to === "string";
  }
  return false;
}

async function fetchConfigured(): Promise<boolean> {
  try {
    const result = await api.checkConfig();
    if (result.configured) {
      setConfiguredGuardCache(true);
      return true;
    }
  } catch {
    // Fall through to init endpoint as source of truth for onboarding completion.
  }

  const init = await api.loadInit();
  const configured = init.setup.isConfigured;
  setConfiguredGuardCache(configured);
  return configured;
}

export async function requireConfigured() {
  const cached = getConfiguredGuardCache(CONFIG_CACHE_TTL);
  if (cached === false) throw redirect({ to: "/onboarding" });
  if (cached === true) return;

  try {
    const configured = await fetchConfigured();
    if (!configured) throw redirect({ to: "/onboarding" });
  } catch (e) {
    if (isRedirectError(e)) throw e;
    setConfiguredGuardCache(false);
    throw redirect({ to: "/onboarding" });
  }
}

export async function requireNotConfigured() {
  const cached = getConfiguredGuardCache(CONFIG_CACHE_TTL);
  if (cached === true) throw redirect({ to: "/" });

  try {
    const configured = await fetchConfigured();
    if (configured) throw redirect({ to: "/" });
  } catch (e) {
    if (isRedirectError(e)) throw e;
    if (cached === false) return;
  }
}
