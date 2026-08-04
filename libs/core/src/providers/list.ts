import type { ConfigurationStatus } from "../schemas/config/configuration-status.js";
import { SELECTABLE_PRODUCTS } from "../schemas/config/provider-registry.js";
import { READINESS_PRESENTATION, type Readiness } from "../schemas/config/readiness.js";
import { type ClientMetadataPayload, projectClientMetadata } from "./client-metadata.js";

export type ProviderListRow = ClientMetadataPayload;

/**
 * The stable identity of a provider row: a configured row is identified by its
 * configuration, an unconfigured placeholder row by its product.
 */
export function getProviderRowId(row: ProviderListRow): string {
  return row.configuration?.configurationId ?? row.product.productId;
}

export function findProviderById(
  rows: readonly ProviderListRow[],
  rowId: string | null | undefined,
): ProviderListRow | null {
  if (rowId === null || rowId === undefined) return null;
  return rows.find((row) => getProviderRowId(row) === rowId) ?? null;
}

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
  return SELECTABLE_PRODUCTS.flatMap((product) => {
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
}
