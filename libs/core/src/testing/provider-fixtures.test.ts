import { describe, expect, it } from "vitest";
import { ConfigurationInitResponseSchema } from "../schemas/config/index.js";
import {
  configurationStatus,
  GEMINI_CONFIGURATION,
  makeConfigurationInitResponse,
  makeReadyInitResponse,
  OPENROUTER_CONFIGURATION,
} from "./provider-fixtures.js";

describe("provider fixtures", () => {
  it("builds a schema-valid ready init response", () => {
    const init = makeReadyInitResponse();

    expect(ConfigurationInitResponseSchema.parse(init)).toEqual(init);
    expect(init.settings.defaultLenses).toEqual(["correctness"]);
  });

  it("builds a schema-valid empty init response", () => {
    const init = makeConfigurationInitResponse([]);

    expect(ConfigurationInitResponseSchema.parse(init)).toEqual(init);
    expect(init.selectedConfigurationId).toBeNull();
  });

  it("keeps custom status lists schema-valid", () => {
    const init = makeConfigurationInitResponse([
      configurationStatus(GEMINI_CONFIGURATION, "ready"),
      configurationStatus(OPENROUTER_CONFIGURATION, "model-missing"),
    ]);

    expect(ConfigurationInitResponseSchema.parse(init)).toEqual(init);
  });
});
