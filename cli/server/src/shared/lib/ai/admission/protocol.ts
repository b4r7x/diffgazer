import { sha256CanonicalJsonSync } from "@diffgazer/core/json";
import {
  buildLensReviewResultJsonSchema,
  type RuntimeIdentity,
} from "@diffgazer/core/schemas/review";

/**
 * Revision of the admission/execution protocol this server speaks — deliberately
 * NOT the package version. Recorded admission evidence survives ordinary server
 * upgrades: it is filed under its own tuple and is never invalidated by age.
 * Bump this only when a change makes evidence recorded by an older binary unsafe
 * to honour, which retires every record filed under the previous revision.
 */
const ADMISSION_PROTOCOL_REVISION = "1.0.0";

export const RUNTIME_IDENTITY: RuntimeIdentity = {
  identity: "diffgazer-server",
  version: ADMISSION_PROTOCOL_REVISION,
};

export const STRUCTURED_OUTPUT_SCHEMA_SHA256 = sha256CanonicalJsonSync(
  buildLensReviewResultJsonSchema(),
);
