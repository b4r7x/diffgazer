import { SELECTABLE_PRODUCTS } from "../schemas/config/provider-registry.js";
import type { ConfigurationStatus } from "../schemas/config/providers.js";
import { READINESS_PRESENTATION, type Readiness } from "../schemas/config/readiness.js";
import { type ClientMetadataPayload, projectClientMetadata } from "./client-metadata.js";

export type ProviderListRow = ClientMetadataPayload;

const UNCONFIGURED_READINESS = {
  status: "unconfigured",
  ready: false,
  evidenceStatus: "not-checked",
  checkedAt: null,
  acknowledgement: { status: "not-applicable" },
  ...READINESS_PRESENTATION.unconfigured,
} as const satisfies Readiness;

function mapConfiguration({ configuration, readiness }: ConfigurationStatus): ProviderListRow {
  return projectClientMetadata({
    productId: configuration.productId,
    configuration,
    readiness,
    notices: configuration.notices,
    actions: configuration.availableActions,
  });
}

export function mapProviderList(
  configurationStatuses: readonly ConfigurationStatus[],
): ProviderListRow[] {
  const selectableRows = SELECTABLE_PRODUCTS.flatMap((product) => {
    if (!product.selectable) return [];

    const matchingConfigurations = configurationStatuses.filter(
      ({ configuration }) => configuration.productId === product.productId,
    );

    if (matchingConfigurations.length > 0) {
      return matchingConfigurations.map(mapConfiguration);
    }

    return [
      projectClientMetadata({
        productId: product.productId,
        configuration: null,
        readiness: UNCONFIGURED_READINESS,
        notices: [product.notice],
        actions: ["create"],
      }),
    ];
  });

  const removedRows = configurationStatuses
    .filter(({ configuration }) => configuration.status === "removed")
    .map(mapConfiguration);

  return [...selectableRows, ...removedRows];
}
