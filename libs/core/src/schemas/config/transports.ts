import { z } from "zod";
import { PRODUCT_ENDPOINT_TUPLES } from "../../providers/product-endpoints.js";
import { type HostedApiProductId, HostedApiProductIdSchema } from "./product-ids.js";

export {
  CANDIDATE_PRODUCT_IDS,
  type CandidateProductId,
  DEFERRED_PRODUCT_IDS,
  EXPERIMENTAL_PRODUCT_IDS,
  HOSTED_API_PRODUCT_IDS,
  type HostedApiProductId,
  HostedApiProductIdSchema,
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

type HostedApiEndpointTuple = (typeof PRODUCT_ENDPOINT_TUPLES)[HostedApiProductId][number];

export function getHostedApiEndpointTuple(
  productId: HostedApiProductId,
  endpoint: string,
): HostedApiEndpointTuple | undefined {
  return PRODUCT_ENDPOINT_TUPLES[productId].find((candidate) => candidate.endpoint === endpoint);
}

export const HostedApiTransportInputSchema = z
  .strictObject({
    transportFamily: z.literal("hosted-api"),
    productId: HostedApiProductIdSchema,
    endpoint: HostedApiEndpointSchema,
  })
  .superRefine((input, context) => {
    if (!getHostedApiEndpointTuple(input.productId, input.endpoint)) {
      context.addIssue({
        code: "custom",
        message: "Endpoint must match the selected product",
        path: ["endpoint"],
      });
    }
  });
export type HostedApiTransportInput = z.infer<typeof HostedApiTransportInputSchema>;
