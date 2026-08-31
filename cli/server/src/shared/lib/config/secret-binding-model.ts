/**
 * The secret-binding data model: the discriminated union a configuration's
 * credential reference is stored as, its zod schemas, and the pure constructors
 * that build one. No filesystem, keyring or environment access lives here — the
 * credential IO that resolves and writes these bindings is `secret-bindings.ts`,
 * so a consumer that only needs the shape does not pull `node:fs` into its graph.
 */
import { ConfigurationIdSchema, ConfigurationRevisionSchema } from "@diffgazer/core/schemas/config";
import { z } from "zod";

const SECRET_BINDING_STATUSES = ["active", "unknown", "removed"] as const;
export type SecretBindingStatus = (typeof SECRET_BINDING_STATUSES)[number];

const SecretBindingStatusSchema = z.enum(SECRET_BINDING_STATUSES).default("active");
const SecretBindingIdentitySchema = z.object({
  configurationId: ConfigurationIdSchema,
  revision: ConfigurationRevisionSchema,
});

const SecretBindingBaseSchema = SecretBindingIdentitySchema.extend({
  status: SecretBindingStatusSchema,
});

const EnvironmentReferenceSchema = SecretBindingBaseSchema.extend({
  kind: z.literal("environment-reference"),
  varName: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
});

const KeyringReferenceSchema = SecretBindingBaseSchema.extend({
  kind: z.literal("keyring-reference"),
  keyId: z.string().min(1).max(512),
});

const FileReferenceSchema = SecretBindingBaseSchema.extend({
  kind: z.literal("file-0600"),
  filePath: z.string().min(1).max(4_096),
});

const LocalBearerSchema = SecretBindingBaseSchema.extend({
  kind: z.literal("optional-local-bearer"),
  storage: z.enum(["environment-reference", "keyring-reference", "file-0600"]),
  reference: z.string().min(1).max(4_096),
});

const NoneBindingSchema = SecretBindingBaseSchema.extend({
  kind: z.literal("none"),
});

export const SecretBindingSchema = z.discriminatedUnion("kind", [
  EnvironmentReferenceSchema,
  KeyringReferenceSchema,
  FileReferenceSchema,
  LocalBearerSchema,
  NoneBindingSchema,
]);

export type EnvironmentSecretBinding = z.infer<typeof EnvironmentReferenceSchema>;
export type KeyringSecretBinding = z.infer<typeof KeyringReferenceSchema>;
export type FileSecretBinding = z.infer<typeof FileReferenceSchema>;
export type OptionalLocalBearerBinding = z.infer<typeof LocalBearerSchema>;
export type NoneSecretBinding = z.infer<typeof NoneBindingSchema>;
export type SecretBinding = z.infer<typeof SecretBindingSchema>;

type SecretBindingReferenceInput =
  | {
      readonly kind: "environment-reference";
      readonly varName: string;
    }
  | {
      readonly kind: "keyring-reference";
      readonly keyId: string;
    }
  | {
      readonly kind: "file-0600";
      readonly filePath: string;
    }
  | {
      readonly kind: "optional-local-bearer";
      readonly storage: "environment-reference" | "keyring-reference" | "file-0600";
      readonly reference: string;
    }
  | { readonly kind: "none" };

export interface SecretBindingIdentity {
  readonly configurationId: string;
  readonly revision: number;
}

export type SecretBindingErrorCode =
  | "INVALID_BINDING"
  | "BINDING_MISMATCH"
  | "BINDING_UNAVAILABLE"
  | "READ_ONLY_REFERENCE"
  | "NO_SECRET_BINDING"
  | "KEYRING_UNAVAILABLE"
  | "FILE_MODE_UNSAFE"
  | "FILE_NOT_FOUND"
  | "DELETE_FAILED";

export class SecretBindingError extends Error {
  readonly code: SecretBindingErrorCode;

  constructor(code: SecretBindingErrorCode, message: string) {
    super(message);
    this.name = "SecretBindingError";
    this.code = code;
  }
}

function identity(configurationId: string, revision: number): SecretBindingIdentity {
  const parsed = SecretBindingIdentitySchema.safeParse({ configurationId, revision });
  if (!parsed.success) throw new SecretBindingError("INVALID_BINDING", "Invalid binding identity");
  return parsed.data;
}

function createSecretBinding(
  configurationId: string,
  revision: number,
  input: SecretBindingReferenceInput,
  status: SecretBindingStatus = "active",
): SecretBinding {
  const base = { ...identity(configurationId, revision), status };
  const candidate = { ...base, ...input };
  const parsed = SecretBindingSchema.safeParse(candidate);
  if (!parsed.success) throw new SecretBindingError("INVALID_BINDING", "Invalid secret binding");
  return parsed.data;
}

export function createEnvironmentSecretBinding(
  configurationId: string,
  revision: number,
  varName: string,
  status: SecretBindingStatus = "active",
): EnvironmentSecretBinding {
  return createSecretBinding(
    configurationId,
    revision,
    { kind: "environment-reference", varName },
    status,
  ) as EnvironmentSecretBinding;
}

export function createKeyringSecretBinding(
  configurationId: string,
  revision: number,
  keyId: string,
  status: SecretBindingStatus = "active",
): KeyringSecretBinding {
  return createSecretBinding(
    configurationId,
    revision,
    { kind: "keyring-reference", keyId },
    status,
  ) as KeyringSecretBinding;
}

export function createFileSecretBinding(
  configurationId: string,
  revision: number,
  filePath: string,
  status: SecretBindingStatus = "active",
): FileSecretBinding {
  return createSecretBinding(
    configurationId,
    revision,
    { kind: "file-0600", filePath },
    status,
  ) as FileSecretBinding;
}

export function createLocalBearerBinding(
  configurationId: string,
  revision: number,
  storage: OptionalLocalBearerBinding["storage"],
  reference: string,
  status: SecretBindingStatus = "active",
): OptionalLocalBearerBinding {
  return createSecretBinding(
    configurationId,
    revision,
    { kind: "optional-local-bearer", storage, reference },
    status,
  ) as OptionalLocalBearerBinding;
}

export function createNoneSecretBinding(
  configurationId: string,
  revision: number,
  status: SecretBindingStatus = "active",
): NoneSecretBinding {
  return createSecretBinding(
    configurationId,
    revision,
    { kind: "none" },
    status,
  ) as NoneSecretBinding;
}

export function markSecretBindingRemoved(binding: SecretBinding): SecretBinding {
  return { ...binding, status: "removed" };
}
