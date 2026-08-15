import { deleteKeyringSecret, readKeyringSecret, writeKeyringSecret } from "./keyring.js";
import type { KeyringSecretStore, SecretBindingIO } from "./secret-bindings.js";

const keyringStore: KeyringSecretStore = {
  read: async (keyId) => {
    const result = await readKeyringSecret(keyId);
    if (!result.ok) throw new Error(`Keyring read failed: ${result.error.message}`);
    return result.value;
  },
  write: async (keyId, value) => {
    const result = await writeKeyringSecret(keyId, value);
    if (!result.ok) throw new Error(`Keyring write failed: ${result.error.message}`);
  },
  delete: async (keyId) => {
    const result = await deleteKeyringSecret(keyId);
    if (!result.ok) throw new Error(`Keyring delete failed: ${result.error.message}`);
    return result.value;
  },
};

export const secretIO: SecretBindingIO = { keyring: keyringStore };
