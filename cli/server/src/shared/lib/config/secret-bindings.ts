import { chmod, mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { ConfigurationIdSchema, ConfigurationRevisionSchema } from "@diffgazer/core/schemas/config";
import { z } from "zod";

const FILE_MODE = 0o600;
const DIRECTORY_MODE = 0o700;
// Only group/other bits make a secret file unsafe. Stricter owner permissions
// (0400 on a hardened install) stay readable and must not be rejected.
const GROUP_OTHER_MASK = 0o077;

export const SECRET_BINDING_KINDS = [
  "environment-reference",
  "keyring-reference",
  "file-0600",
  "optional-local-bearer",
  "none",
] as const;
export type SecretBindingKind = (typeof SECRET_BINDING_KINDS)[number];

export const SECRET_BINDING_STATUSES = ["active", "unknown", "removed"] as const;
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

export type SecretBindingReferenceInput =
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

export type WriteOnlySecretInput =
  | { readonly kind: "literal"; readonly value: string }
  | { readonly kind: "environment"; readonly varName: string }
  | { readonly kind: "none" };

export interface SecretBindingIdentity {
  readonly configurationId: string;
  readonly revision: number;
}

export interface KeyringSecretStore {
  readonly read: (keyId: string) => string | null | Promise<string | null>;
  readonly write: (keyId: string, value: string) => void | Promise<void>;
  readonly delete: (keyId: string) => boolean | Promise<boolean>;
}

export interface SecretBindingIO {
  readonly env?: NodeJS.ProcessEnv;
  readonly keyring?: KeyringSecretStore;
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

function activeStatus(status: SecretBindingStatus = "active"): SecretBindingStatus {
  if (status === "active" || status === "unknown" || status === "removed") return status;
  throw new SecretBindingError("INVALID_BINDING", "Invalid binding status");
}

export function createSecretBinding(
  configurationId: string,
  revision: number,
  input: SecretBindingReferenceInput,
  status: SecretBindingStatus = "active",
): SecretBinding {
  const base = { ...identity(configurationId, revision), status: activeStatus(status) };
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

export interface SafeSecretBindingProjection {
  readonly configurationId: string;
  readonly revision: number;
  readonly kind: SecretBindingKind;
  readonly status: SecretBindingStatus;
}

/** Return only non-sensitive binding identity; references and values stay server-side. */
export function toSafeSecretBinding(binding: SecretBinding): SafeSecretBindingProjection {
  const parsed = SecretBindingSchema.parse(binding);
  return {
    configurationId: parsed.configurationId,
    revision: parsed.revision,
    kind: parsed.kind,
    status: parsed.status,
  };
}

/** Serialize persistence metadata only. Secret values are never part of SecretBinding. */
export function serializeSecretBinding(binding: SecretBinding): string {
  const parsed = SecretBindingSchema.parse(binding);
  return JSON.stringify(parsed);
}

function assertExpectedIdentity(
  binding: SecretBinding,
  expected?: Partial<SecretBindingIdentity>,
): void {
  if (!expected) return;
  if (
    (expected.configurationId !== undefined &&
      expected.configurationId !== binding.configurationId) ||
    (expected.revision !== undefined && expected.revision !== binding.revision)
  ) {
    throw new SecretBindingError("BINDING_MISMATCH", "Secret binding identity does not match");
  }
}

function assertResolvable(binding: SecretBinding): void {
  if (binding.status !== "active") {
    throw new SecretBindingError("BINDING_UNAVAILABLE", "Secret binding is not executable");
  }
}

async function readReference(
  storage: OptionalLocalBearerBinding["storage"],
  reference: string,
  io: SecretBindingIO,
): Promise<string | null> {
  if (storage === "environment-reference") return (io.env ?? process.env)[reference] ?? null;
  if (storage === "keyring-reference") {
    if (!io.keyring) throw new SecretBindingError("KEYRING_UNAVAILABLE", "Keyring is unavailable");
    return (await io.keyring.read(reference)) ?? null;
  }

  let fileStats: Awaited<ReturnType<typeof stat>>;
  try {
    fileStats = await stat(reference);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new SecretBindingError("FILE_NOT_FOUND", "Secret file is missing");
    }
    throw new SecretBindingError("BINDING_UNAVAILABLE", "Secret file cannot be read");
  }
  if ((fileStats.mode & GROUP_OTHER_MASK) !== 0) {
    throw new SecretBindingError(
      "FILE_MODE_UNSAFE",
      "Secret file must not be readable or writable by group or others",
    );
  }
  return readFile(reference, "utf8");
}

export async function resolveSecretBinding(
  binding: SecretBinding,
  io: SecretBindingIO = {},
  expected?: Partial<SecretBindingIdentity>,
): Promise<string | null> {
  const parsed = SecretBindingSchema.parse(binding);
  assertExpectedIdentity(parsed, expected);
  assertResolvable(parsed);

  switch (parsed.kind) {
    case "none":
      return null;
    case "environment-reference":
      return (io.env ?? process.env)[parsed.varName] ?? null;
    case "keyring-reference":
      return readReference("keyring-reference", parsed.keyId, io);
    case "file-0600":
      return readReference("file-0600", parsed.filePath, io);
    case "optional-local-bearer":
      return readReference(parsed.storage, parsed.reference, io);
  }
}

function requireSecretValue(value: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new SecretBindingError("INVALID_BINDING", "Secret value must not be empty");
  }
}

async function writeReference(
  storage: "keyring-reference" | "file-0600",
  reference: string,
  value: string,
  io: SecretBindingIO,
): Promise<void> {
  if (storage === "keyring-reference") {
    if (!io.keyring) throw new SecretBindingError("KEYRING_UNAVAILABLE", "Keyring is unavailable");
    await io.keyring.write(reference, value);
    return;
  }

  try {
    await mkdir(dirname(reference), { recursive: true, mode: DIRECTORY_MODE });
    await writeFile(reference, value, { encoding: "utf8", mode: FILE_MODE });
    await chmod(reference, FILE_MODE);
  } catch {
    throw new SecretBindingError("BINDING_UNAVAILABLE", "Secret file cannot be written");
  }
}

export async function writeSecretBinding(
  binding: SecretBinding,
  value: string,
  io: SecretBindingIO = {},
  expected?: Partial<SecretBindingIdentity>,
): Promise<void> {
  const parsed = SecretBindingSchema.parse(binding);
  assertExpectedIdentity(parsed, expected);
  assertResolvable(parsed);
  requireSecretValue(value);

  switch (parsed.kind) {
    case "environment-reference":
      throw new SecretBindingError("READ_ONLY_REFERENCE", "Environment references are read-only");
    case "keyring-reference":
      return writeReference("keyring-reference", parsed.keyId, value, io);
    case "file-0600":
      return writeReference("file-0600", parsed.filePath, value, io);
    case "optional-local-bearer":
      if (parsed.storage === "environment-reference") {
        throw new SecretBindingError("READ_ONLY_REFERENCE", "Environment references are read-only");
      }
      return writeReference(parsed.storage, parsed.reference, value, io);
    case "none":
      throw new SecretBindingError("NO_SECRET_BINDING", "Binding does not accept a secret");
  }
}

export interface BindWriteOnlySecretOptions extends SecretBindingIO {
  readonly filePath?: string;
  readonly keyId?: string;
  readonly varName?: string;
  readonly localBearer?: boolean;
}

/** Consume a write-only input and return metadata; literal values are written then discarded. */
export async function bindWriteOnlySecret(
  configurationId: string,
  revision: number,
  input: WriteOnlySecretInput,
  options: BindWriteOnlySecretOptions = {},
): Promise<SecretBinding> {
  if (input.kind === "none") return createNoneSecretBinding(configurationId, revision);
  if (input.kind === "environment") {
    const varName = input.varName || options.varName;
    if (!varName)
      throw new SecretBindingError("INVALID_BINDING", "Environment variable is required");
    if (options.localBearer) {
      return createLocalBearerBinding(configurationId, revision, "environment-reference", varName);
    }
    return createEnvironmentSecretBinding(configurationId, revision, varName);
  }

  requireSecretValue(input.value);
  if (options.localBearer) {
    let storage: "keyring-reference" | "file-0600" | undefined;
    if (options.keyId) storage = "keyring-reference";
    else if (options.filePath) storage = "file-0600";
    if (!storage) throw new SecretBindingError("INVALID_BINDING", "Secret storage is required");
    const reference = storage === "keyring-reference" ? options.keyId : options.filePath;
    if (!reference) throw new SecretBindingError("INVALID_BINDING", "Secret reference is required");
    const binding = createLocalBearerBinding(configurationId, revision, storage, reference);
    await writeSecretBinding(binding, input.value, options);
    return binding;
  }

  if (options.keyId) {
    const binding = createKeyringSecretBinding(configurationId, revision, options.keyId);
    await writeSecretBinding(binding, input.value, options);
    return binding;
  }
  if (options.filePath) {
    const binding = createFileSecretBinding(configurationId, revision, options.filePath);
    await writeSecretBinding(binding, input.value, options);
    return binding;
  }
  throw new SecretBindingError("INVALID_BINDING", "Secret storage is required");
}

async function deleteReference(binding: SecretBinding, io: SecretBindingIO): Promise<boolean> {
  switch (binding.kind) {
    case "none":
    case "environment-reference":
      return true;
    case "keyring-reference":
      if (!io.keyring)
        throw new SecretBindingError("KEYRING_UNAVAILABLE", "Keyring is unavailable");
      return Boolean(await io.keyring.delete(binding.keyId));
    case "file-0600":
      try {
        await unlink(binding.filePath);
        return true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
        throw new SecretBindingError("DELETE_FAILED", "Secret file cannot be deleted");
      }
    case "optional-local-bearer":
      if (binding.storage === "environment-reference") return true;
      return deleteReference(
        binding.storage === "keyring-reference"
          ? createKeyringSecretBinding(binding.configurationId, binding.revision, binding.reference)
          : createFileSecretBinding(binding.configurationId, binding.revision, binding.reference),
        io,
      );
  }
}

export async function deleteSecretBinding(
  binding: SecretBinding,
  io: SecretBindingIO = {},
  expected?: Partial<SecretBindingIdentity>,
): Promise<boolean> {
  const parsed = SecretBindingSchema.parse(binding);
  assertExpectedIdentity(parsed, expected);
  return deleteReference(parsed, io);
}

export interface SecretBindingDeletionHooks {
  readonly revoke: () => void | Promise<void>;
  readonly cancel: () => void | Promise<void>;
  readonly drain: () => void | Promise<void>;
}

export interface SecretBindingDeletionResult {
  readonly configurationId: string;
  readonly revision: number;
  readonly deleted: boolean;
}

/** Revoke, cancel, and drain before touching the named secret binding. */
export async function deleteSecretBindingTransactional(
  binding: SecretBinding,
  hooks: SecretBindingDeletionHooks,
  io: SecretBindingIO = {},
): Promise<SecretBindingDeletionResult> {
  const parsed = SecretBindingSchema.parse(binding);
  await hooks.revoke();
  await hooks.cancel();
  await hooks.drain();
  const deleted = await deleteSecretBinding(parsed, io, {
    configurationId: parsed.configurationId,
    revision: parsed.revision,
  });
  return {
    configurationId: parsed.configurationId,
    revision: parsed.revision,
    deleted,
  };
}
