import { ConfigurationIdSchema } from "@diffgazer/core/schemas/config";
import { z } from "zod";

export { ClientConfigurationActionSchema } from "@diffgazer/core/schemas/config";

export const ConfigurationModelsParamSchema = z.object({
  configurationId: ConfigurationIdSchema,
});
