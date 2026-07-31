import {
  PRODUCT_REGISTRY,
  type ProductNotice,
  type RunnableProductDescriptor,
} from "../providers/product-registry.js";
import type { Readiness, ReadinessStatus } from "../schemas/config/readiness.js";
import {
  CANDIDATE_PRODUCT_IDS,
  type CandidateProductId,
  type RemovedProductId,
  type RunnableProductId,
  type TransportFamily,
} from "../schemas/config/transports.js";

export type SetupProductId = RunnableProductId | RemovedProductId | CandidateProductId;

type ConfigurationField =
  RunnableProductDescriptor<RunnableProductId>["configuration"]["fields"][number];

export type RunnableSetupStep =
  | {
      readonly id: "product";
      readonly label: string;
    }
  | {
      readonly id: "endpoint-binding";
      readonly requiredFields: readonly ConfigurationField[];
      readonly endpoints: RunnableProductDescriptor<RunnableProductId>["configuration"]["endpoints"];
    }
  | {
      readonly id: "authentication";
      readonly credentialKind: RunnableProductDescriptor<RunnableProductId>["configuration"]["credentialKind"];
      readonly requiredFields: readonly ConfigurationField[];
    }
  | {
      readonly id: "model";
      readonly discovery: "configuration-bound";
      readonly selection: "exact";
      readonly aliases: "forbidden";
      readonly policy: RunnableProductDescriptor<RunnableProductId>["modelPolicy"];
    }
  | {
      readonly id: "conformance";
      readonly action: "test";
      readonly requiredChecks: RunnableProductDescriptor<RunnableProductId>["admission"]["requiredChecks"];
      readonly structuredOutput: RunnableProductDescriptor<RunnableProductId>["admission"]["structuredOutput"];
      readonly usage: RunnableProductDescriptor<RunnableProductId>["admission"]["usage"];
    }
  | {
      readonly id: "acknowledgement";
      readonly acceptance: "explicit";
      readonly notice: ProductNotice;
    };

export interface SetupRemediation {
  readonly status: ReadinessStatus;
  readonly action: Readiness["action"];
  readonly code: Readiness["remediation"]["code"];
  readonly message: string;
}

export interface RunnableSetupPlan {
  readonly kind: "runnable";
  readonly productId: RunnableProductId;
  readonly transportFamily: TransportFamily;
  readonly requiredFields: readonly ConfigurationField[];
  readonly steps: readonly RunnableSetupStep[];
  readonly remediation: SetupRemediation | null;
}

export interface RemovedSetupPlan {
  readonly kind: "removed";
  readonly productId: RemovedProductId;
  readonly steps: readonly [
    {
      readonly id: "migration";
      readonly action: "create-new-zai-configuration";
      readonly targetProductId: "zai";
      readonly credentialHandling: "retain-until-explicit-delete-never-copy-test-or-send";
    },
    {
      readonly id: "delete";
      readonly action: "delete-removed-record";
    },
  ];
}

export type SetupPlan = RunnableSetupPlan | RemovedSetupPlan;

function isCandidateProductId(productId: SetupProductId): productId is CandidateProductId {
  return CANDIDATE_PRODUCT_IDS.some((candidateId) => candidateId === productId);
}

function buildRemediation(readiness?: Readiness): SetupRemediation | null {
  if (!readiness || readiness.ready) return null;
  return {
    status: readiness.status,
    action: readiness.action,
    code: readiness.remediation.code,
    message: readiness.remediation.message,
  };
}

function buildRunnablePlan(
  product: RunnableProductDescriptor<RunnableProductId>,
  readiness?: Readiness,
): RunnableSetupPlan {
  const endpointFields = product.configuration.fields.filter(
    (field) => field === "endpoint" || field === "region" || field === "workspace",
  );
  const authenticationFields = product.configuration.fields.filter(
    (field) =>
      field === "credential" || field === "local-authentication" || field === "installation",
  );
  const steps: RunnableSetupStep[] = [{ id: "product", label: product.presentation.setupLabel }];

  if (product.configuration.endpoints.length > 0) {
    steps.push({
      id: "endpoint-binding",
      requiredFields: endpointFields,
      endpoints: product.configuration.endpoints,
    });
  }
  if (authenticationFields.length > 0) {
    steps.push({
      id: "authentication",
      credentialKind: product.configuration.credentialKind,
      requiredFields: authenticationFields,
    });
  }
  steps.push(
    {
      id: "model",
      discovery: "configuration-bound",
      selection: "exact",
      aliases: product.modelPolicy.aliases,
      policy: product.modelPolicy,
    },
    {
      id: "conformance",
      action: "test",
      requiredChecks: product.admission.requiredChecks,
      structuredOutput: product.admission.structuredOutput,
      usage: product.admission.usage,
    },
    {
      id: "acknowledgement",
      acceptance: "explicit",
      notice: product.notice,
    },
  );

  return {
    kind: "runnable",
    productId: product.id,
    transportFamily: product.transportFamily,
    requiredFields: product.configuration.fields,
    steps,
    remediation: buildRemediation(readiness),
  };
}

export function buildSetupPlan(productId: SetupProductId, readiness?: Readiness): SetupPlan | null {
  if (isCandidateProductId(productId)) return null;

  const product = PRODUCT_REGISTRY[productId];
  if (product.kind === "removed") {
    return {
      kind: "removed",
      productId: product.id,
      steps: [
        {
          id: "migration",
          action: product.migration.actions[0],
          targetProductId: product.migration.targetProductId,
          credentialHandling: product.migration.credentialHandling,
        },
        { id: "delete", action: product.migration.actions[1] },
      ],
    };
  }

  return buildRunnablePlan(product, readiness);
}
