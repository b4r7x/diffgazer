import { z } from "zod";
import { PRODUCT_ENDPOINT_TUPLES } from "../../providers/product-endpoints.js";
import { containsStructuralControlCharacter } from "../../sanitize-terminal.js";
import {
  type HostedApiProductId,
  HostedApiProductIdSchema,
  LocalCliProductIdSchema,
  type LocalHttpProductId,
  LocalHttpProductIdSchema,
} from "./product-ids.js";

export {
  CANDIDATE_PRODUCT_IDS,
  type CandidateProductId,
  DEFERRED_PRODUCT_IDS,
  EXPERIMENTAL_PRODUCT_IDS,
  HOSTED_API_PRODUCT_IDS,
  type HostedApiProductId,
  HostedApiProductIdSchema,
  LOCAL_CLI_PRODUCT_IDS,
  LOCAL_HTTP_PRODUCT_IDS,
  type LocalCliProductId,
  LocalCliProductIdSchema,
  type LocalHttpProductId,
  LocalHttpProductIdSchema,
  REJECTED_PRODUCT_IDS,
  RUNNABLE_PRODUCT_IDS,
  type RunnableProductId,
  RunnableProductIdSchema,
  TRANSPORT_FAMILIES,
  type TransportFamily,
  TransportFamilySchema,
} from "./product-ids.js";

function parseEndpoint(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

const NormalizedEndpointSchema = z
  .url()
  .max(2_048)
  .superRefine((value, context) => {
    const endpoint = parseEndpoint(value);
    if (!endpoint) return;

    if (endpoint.username || endpoint.password) {
      context.addIssue({ code: "custom", message: "Endpoint must not contain user info" });
    }
    if (endpoint.search) {
      context.addIssue({ code: "custom", message: "Endpoint must not contain a query" });
    }
    if (endpoint.hash) {
      context.addIssue({ code: "custom", message: "Endpoint must not contain a fragment" });
    }

    const pathname = endpoint.pathname === "/" ? "" : endpoint.pathname;
    if (value !== `${endpoint.origin}${pathname}`) {
      context.addIssue({ code: "custom", message: "Endpoint must be normalized" });
    }
  });

export const HostedApiEndpointSchema = NormalizedEndpointSchema.superRefine((value, context) => {
  const endpoint = parseEndpoint(value);
  if (endpoint && (endpoint.protocol !== "https:" || endpoint.port)) {
    context.addIssue({
      code: "custom",
      message: "Hosted API endpoints must use HTTPS on the default port",
    });
  }
});
export type HostedApiEndpoint = z.infer<typeof HostedApiEndpointSchema>;

function isLoopbackHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "[::1]" || /^127(?:\.\d{1,3}){3}$/.test(hostname);
}

export const LoopbackHttpEndpointSchema = NormalizedEndpointSchema.superRefine((value, context) => {
  const endpoint = parseEndpoint(value);
  if (endpoint && endpoint.protocol !== "http:") {
    context.addIssue({ code: "custom", message: "Local endpoints must use HTTP" });
  }
  if (endpoint && !isLoopbackHostname(endpoint.hostname)) {
    context.addIssue({ code: "custom", message: "Local endpoints must use a loopback host" });
  }
});
export type LoopbackHttpEndpoint = z.infer<typeof LoopbackHttpEndpointSchema>;

export const LOCAL_OPENAI_PRESET_IDS = ["lm-studio", "llama-cpp"] as const;
export const LocalOpenAIPresetIdSchema = z.enum(LOCAL_OPENAI_PRESET_IDS);
export type LocalOpenAIPresetId = z.infer<typeof LocalOpenAIPresetIdSchema>;

type HostedApiEndpointTuple = (typeof PRODUCT_ENDPOINT_TUPLES)[HostedApiProductId][number];

export function getHostedApiEndpointTuple(
  productId: HostedApiProductId,
  endpoint: string,
  region: string | undefined,
): HostedApiEndpointTuple | undefined {
  return PRODUCT_ENDPOINT_TUPLES[productId].find(
    (candidate) =>
      candidate.endpoint === endpoint &&
      ("region" in candidate ? candidate.region : undefined) === region,
  );
}

export function matchesHostedApiTransportTuple(input: {
  readonly productId: HostedApiProductId;
  readonly endpoint: string;
  readonly region?: string;
  readonly workspace?: string;
}): boolean {
  const profile = getHostedApiEndpointTuple(input.productId, input.endpoint, input.region);
  if (!profile) return false;

  const workspaceRequired = "workspaceBound" in profile && profile.workspaceBound === true;
  return workspaceRequired ? input.workspace !== undefined : input.workspace === undefined;
}

function getLocalOpenAIPresetEndpoint(presetId: LocalOpenAIPresetId): LoopbackHttpEndpoint {
  const profile = PRODUCT_ENDPOINT_TUPLES["local-openai"].find(({ id }) => id === presetId);
  if (!profile) throw new Error(`Missing local-openai preset endpoint: ${presetId}`);
  return LoopbackHttpEndpointSchema.parse(profile.endpoint);
}

export function matchesLocalHttpTransportTuple(input: {
  readonly productId: LocalHttpProductId;
  readonly endpoint: string;
  readonly presetId?: LocalOpenAIPresetId;
}): boolean {
  if (input.presetId === undefined) return true;
  if (input.productId !== "local-openai") return false;
  return input.endpoint === getLocalOpenAIPresetEndpoint(input.presetId);
}

export const LOCAL_OPENAI_PRESET_ENDPOINTS = {
  "lm-studio": getLocalOpenAIPresetEndpoint("lm-studio"),
  "llama-cpp": getLocalOpenAIPresetEndpoint("llama-cpp"),
} as const satisfies Record<LocalOpenAIPresetId, LoopbackHttpEndpoint>;

// Region and workspace values are opaque identifiers at this boundary. They are
// not interpolated into a URL or shell command here, but accepting control
// characters would still let them cross logs, JSON lines, and other textual
// boundaries with misleading structure.
const ConfigurationReferenceSchema = z
  .string()
  .min(1)
  .max(256)
  .refine(
    (value) => !containsStructuralControlCharacter(value),
    "Reference must not contain control characters",
  )
  .refine((value) => value === value.trim(), "Reference must not have surrounding whitespace");

export const LOCAL_HTTP_AUTHENTICATION_MODES = ["none", "optional-local-bearer"] as const;
export const LocalHttpAuthenticationModeSchema = z.enum(LOCAL_HTTP_AUTHENTICATION_MODES);
export type LocalHttpAuthenticationMode = z.infer<typeof LocalHttpAuthenticationModeSchema>;

export const HostedApiTransportInputSchema = z
  .strictObject({
    transportFamily: z.literal("hosted-api"),
    productId: HostedApiProductIdSchema,
    endpoint: HostedApiEndpointSchema,
    region: ConfigurationReferenceSchema.optional(),
    workspace: ConfigurationReferenceSchema.optional(),
  })
  .superRefine((input, context) => {
    const tuple = getHostedApiEndpointTuple(input.productId, input.endpoint, input.region);
    if (!tuple || !matchesHostedApiTransportTuple(input)) {
      context.addIssue({
        code: "custom",
        message: tuple
          ? "Workspace reference must match the selected endpoint"
          : "Endpoint and region must match the selected product",
        path: ["endpoint"],
      });
      if (tuple && "workspaceBound" in tuple && tuple.workspaceBound) {
        context.addIssue({
          code: "custom",
          message: "Selected endpoint requires a workspace reference",
          path: ["workspace"],
        });
      } else if (tuple && input.workspace !== undefined) {
        context.addIssue({
          code: "custom",
          message: "Selected endpoint does not accept a workspace reference",
          path: ["workspace"],
        });
      }
    }
  });
export type HostedApiTransportInput = z.infer<typeof HostedApiTransportInputSchema>;

export const LocalHttpTransportInputSchema = z
  .strictObject({
    transportFamily: z.literal("local-http"),
    productId: LocalHttpProductIdSchema,
    endpoint: LoopbackHttpEndpointSchema,
    authentication: LocalHttpAuthenticationModeSchema,
    presetId: LocalOpenAIPresetIdSchema.optional(),
  })
  .superRefine((input, context) => {
    if (!matchesLocalHttpTransportTuple(input)) {
      context.addIssue({
        code: "custom",
        message:
          input.productId === "ollama"
            ? "Local OpenAI presets do not apply to Ollama"
            : "Preset endpoint does not match its fixed identity",
        path: input.productId === "ollama" ? ["presetId"] : ["endpoint"],
      });
    }
  });
export type LocalHttpTransportInput = z.infer<typeof LocalHttpTransportInputSchema>;

export const LocalCliInstallationIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
export type LocalCliInstallationId = z.infer<typeof LocalCliInstallationIdSchema>;

export const LocalCliTransportInputSchema = z.strictObject({
  transportFamily: z.literal("local-cli"),
  productId: LocalCliProductIdSchema,
  installationId: LocalCliInstallationIdSchema,
});
export type LocalCliTransportInput = z.infer<typeof LocalCliTransportInputSchema>;
