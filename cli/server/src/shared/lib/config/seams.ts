import type { ConfigurationId } from "@diffgazer/core/schemas/config";
import { log } from "../log.js";
import type { ConfigurationConformanceProbe } from "./conformance.js";

/** Re-keys review history on a project move. */
type ReviewRekeyHandler = (oldProjectPath: string, newProjectPath: string) => Promise<boolean>;

/**
 * Lease lifecycle hooks for the delete action, so deletion rejects new leases,
 * cancels queued work, and waits for active work to release before credentials
 * are removed.
 */
export interface ConfigurationLeaseHooks {
  revoke: (configurationId: ConfigurationId) => void | Promise<void>;
  cancel: (configurationId: ConfigurationId) => void | Promise<void>;
  drain: (configurationId: ConfigurationId) => void | Promise<void>;
  /** Restores admission for a configuration a failed delete left in place. */
  clearRevocation: (configurationId: ConfigurationId) => void | Promise<void>;
}

/**
 * The collaborators `shared/lib/config` cannot reach on its own: the review
 * feature owns re-keying, the session registry owns lease authority, and the ai
 * adapters own the conformance transport, all of which sit the wrong way round
 * from this module's import direction. The composition root registers all three
 * in one call.
 */
export interface ConfigSeams {
  reviewRekeyHandler: ReviewRekeyHandler;
  leaseHooks: ConfigurationLeaseHooks | null;
  conformanceProbe: ConfigurationConformanceProbe;
}

// Every default fails closed, so a missing composition-root registration is a
// visible refusal instead of a silent success.
const UNREGISTERED_SEAMS: ConfigSeams = {
  // Report failure so an unwired move leaves project.json on the old root (a
  // retried move) instead of claiming the history moved.
  reviewRekeyHandler: async () => {
    log("error", "review_rekey_handler_not_registered");
    return false;
  },
  // No default: a store that cannot observe leases must refuse to delete rather
  // than remove credentials an execution may still be using.
  leaseHooks: null,
  // A skipped observation never becomes evidence, so an unwired server refuses
  // to admit rather than admitting on an unobserved tuple.
  conformanceProbe: async () => {
    log("error", "conformance_probe_not_registered");
    return { status: "skipped", reason: "No conformance probe is registered" };
  },
};

let seams: ConfigSeams = UNREGISTERED_SEAMS;

/** Install the seams a host provides; unnamed seams keep their current value. */
export function registerConfigSeams(registration: Partial<ConfigSeams>): void {
  seams = { ...seams, ...registration };
}

/** Restore the fail-closed defaults. */
export function resetConfigSeams(): void {
  seams = UNREGISTERED_SEAMS;
}

export function getConfigSeams(): ConfigSeams {
  return seams;
}
