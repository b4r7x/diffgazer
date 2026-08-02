/**
 * Stable keyring namespace for a configuration binding.  Provider names are
 * deliberately absent: two configurations for one product must never share a
 * credential, and a revision change must produce a new key.
 */
export function getConfigurationSecretName(configurationId: string, revision: number): string {
  return `secret_binding_${configurationId}_${revision}`;
}
