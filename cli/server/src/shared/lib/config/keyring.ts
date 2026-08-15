import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { createError } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";
import { log } from "../log.js";
import type { SecretsStorageError, SecretsStorageErrorCode } from "./types.js";

type KeyringModule = typeof import("@napi-rs/keyring");
type AsyncKeyringEntry = InstanceType<KeyringModule["AsyncEntry"]>;

const KEYRING_APP_NAME = "diffgazer";
const KEYRING_TEST_KEY_PREFIX = "__diffgazer_keyring_test__";
const KEYRING_PROBE_TIMEOUT_MS = 5_000;

const requireModule = createRequire(import.meta.url);
let cachedKeyring: KeyringModule | null | undefined;
let cachedKeyringAvailable: boolean | null = null;

const loadKeyring = (): KeyringModule | null => {
  if (cachedKeyring !== undefined) return cachedKeyring;

  try {
    cachedKeyring = requireModule("@napi-rs/keyring") as KeyringModule;
  } catch {
    cachedKeyring = null;
    log("warn", "keyring_module_unavailable", {
      code: "KEYRING_UNAVAILABLE",
      operation: "load",
    });
  }

  return cachedKeyring;
};

const probeAbortSignal = (): AbortSignal => AbortSignal.timeout(KEYRING_PROBE_TIMEOUT_MS);

const checkKeyringAvailability = async (keyring: KeyringModule): Promise<boolean> => {
  const testKey = `${KEYRING_TEST_KEY_PREFIX}${randomUUID()}`;
  let entry: AsyncKeyringEntry | null = null;

  try {
    entry = new keyring.AsyncEntry(KEYRING_APP_NAME, testKey);
    const testValue = `test_${randomUUID()}`;
    await entry.setPassword(testValue, probeAbortSignal());
    const readBack = await entry.getPassword(probeAbortSignal());
    if (readBack !== testValue) {
      log("warn", "keyring_availability_check_failed", {
        code: "KEYRING_UNAVAILABLE",
        operation: "probe",
      });
      return false;
    }
    return true;
  } catch {
    log("warn", "keyring_availability_check_failed", {
      code: "KEYRING_UNAVAILABLE",
      operation: "probe",
    });
    return false;
  } finally {
    if (entry) {
      try {
        const deleted = await entry.deleteCredential(probeAbortSignal());
        if (!deleted) {
          log("warn", "keyring_test_key_cleanup_failed", {
            code: "KEYRING_DELETE_FAILED",
            operation: "delete",
          });
        }
      } catch {
        log("warn", "keyring_test_key_cleanup_failed", {
          code: "KEYRING_DELETE_FAILED",
          operation: "delete",
        });
      }
    }
  }
};

/**
 * The probe is a real keychain write/read/delete round trip, so its result is
 * cached in both directions: an unavailable keyring would otherwise re-prompt for
 * an unlock (and re-log a warning) on every secret read, write, and delete.
 * `refresh` re-probes for the settings flow, the one caller that asks on purpose
 * and must let a keychain unlocked mid-session recover without a restart.
 */
export const isKeyringAvailable = async (
  options: Readonly<{ refresh?: boolean }> = {},
): Promise<boolean> => {
  if (!options.refresh && cachedKeyringAvailable !== null) return cachedKeyringAvailable;

  const keyring = loadKeyring();
  if (!keyring) {
    cachedKeyringAvailable = false;
    return false;
  }

  cachedKeyringAvailable = await checkKeyringAvailability(keyring);
  return cachedKeyringAvailable;
};

const requireKeyring = async (): Promise<Result<KeyringModule, SecretsStorageError>> => {
  const keyring = loadKeyring();
  if (!keyring || !(await isKeyringAvailable())) {
    return err(
      createError<SecretsStorageErrorCode>(
        "KEYRING_UNAVAILABLE",
        "System keyring is not available",
      ),
    );
  }
  return ok(keyring);
};

export const readKeyringSecret = async (
  key: string,
): Promise<Result<string | null, SecretsStorageError>> => {
  const keyringResult = await requireKeyring();
  if (!keyringResult.ok) return keyringResult;

  try {
    const entry = new keyringResult.value.AsyncEntry(KEYRING_APP_NAME, key);
    const value = await entry.getPassword();
    return ok(value ?? null);
  } catch {
    log("warn", "keyring_read_failed", {
      code: "KEYRING_READ_FAILED",
      operation: "read",
    });
    return err(
      createError<SecretsStorageErrorCode>(
        "KEYRING_READ_FAILED",
        "Failed to read secret from keyring",
      ),
    );
  }
};

export const writeKeyringSecret = async (
  key: string,
  value: string,
): Promise<Result<void, SecretsStorageError>> => {
  const keyringResult = await requireKeyring();
  if (!keyringResult.ok) return keyringResult;

  try {
    const entry = new keyringResult.value.AsyncEntry(KEYRING_APP_NAME, key);
    await entry.setPassword(value);
    return ok(undefined);
  } catch {
    log("warn", "keyring_write_failed", {
      code: "KEYRING_WRITE_FAILED",
      operation: "write",
    });
    return err(
      createError<SecretsStorageErrorCode>(
        "KEYRING_WRITE_FAILED",
        "Failed to store secret in keyring",
      ),
    );
  }
};

export const deleteKeyringSecret = async (
  key: string,
): Promise<Result<boolean, SecretsStorageError>> => {
  const existingResult = await readKeyringSecret(key);
  if (!existingResult.ok) return existingResult;
  if (existingResult.value === null) return ok(false);

  const keyringResult = await requireKeyring();
  if (!keyringResult.ok) return keyringResult;

  try {
    const entry = new keyringResult.value.AsyncEntry(KEYRING_APP_NAME, key);
    const deleted = await entry.deleteCredential();
    if (!deleted) {
      log("warn", "keyring_delete_failed", {
        code: "KEYRING_DELETE_FAILED",
        operation: "delete",
      });
      return err(
        createError<SecretsStorageErrorCode>(
          "KEYRING_DELETE_FAILED",
          "Failed to delete secret from keyring",
        ),
      );
    }
    return ok(true);
  } catch {
    log("warn", "keyring_delete_failed", {
      code: "KEYRING_DELETE_FAILED",
      operation: "delete",
    });
    return err(
      createError<SecretsStorageErrorCode>(
        "KEYRING_DELETE_FAILED",
        "Failed to delete secret from keyring",
      ),
    );
  }
};
