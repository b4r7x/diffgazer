import { describe, expect, it } from "vitest";
import type { TrustCapabilities } from "./settings.js";
import {
  fromSelectedCapabilityIds,
  getInitialFocusedCapability,
  getTrustButtonLabel,
  hasRepositoryReadAccess,
  isFocusableCapability,
  NO_TRUST_CAPABILITIES,
  normalizeTrustCapabilities,
  TRUST_CAPABILITY_OPTIONS,
  TRUST_SECURITY_WARNING,
  toSelectedCapabilityIds,
} from "./trust-capabilities.js";

describe("trust capabilities model", () => {
  describe("hasRepositoryReadAccess", () => {
    const trust = {
      repoRoot: "/work/repo",
      capabilities: { readFiles: true, runCommands: false },
    };

    it("allows reads only when the capability belongs to the current repository root", () => {
      expect(hasRepositoryReadAccess(trust, "/work/repo")).toBe(true);
      expect(hasRepositoryReadAccess(trust, "/work/moved-repo")).toBe(false);
    });

    it("denies reads when trust or the current repository root is unavailable", () => {
      expect(hasRepositoryReadAccess(null, "/work/repo")).toBe(false);
      expect(hasRepositoryReadAccess(trust, null)).toBe(false);
    });

    it("denies reads when the repository capability is disabled", () => {
      expect(
        hasRepositoryReadAccess(
          { ...trust, capabilities: { readFiles: false, runCommands: false } },
          "/work/repo",
        ),
      ).toBe(false);
    });
  });

  describe("normalizeTrustCapabilities", () => {
    it("returns NO_TRUST_CAPABILITIES when value is null", () => {
      expect(normalizeTrustCapabilities(null)).toEqual(NO_TRUST_CAPABILITIES);
    });

    it("returns NO_TRUST_CAPABILITIES when value is undefined", () => {
      expect(normalizeTrustCapabilities(undefined)).toEqual(NO_TRUST_CAPABILITIES);
    });

    it("preserves readFiles when present", () => {
      const result = normalizeTrustCapabilities({ readFiles: true, runCommands: false });
      expect(result.readFiles).toBe(true);
    });

    it("forces runCommands to false even when input has it true", () => {
      const result = normalizeTrustCapabilities({ readFiles: true, runCommands: true });
      expect(result.runCommands).toBe(false);
    });
  });

  describe("toSelectedCapabilityIds", () => {
    it("returns readFiles when enabled", () => {
      const value: TrustCapabilities = { readFiles: true, runCommands: false };
      expect(toSelectedCapabilityIds(value)).toEqual(["readFiles"]);
    });

    it("omits disabled options even when value bit is set", () => {
      const value: TrustCapabilities = { readFiles: false, runCommands: true };
      expect(toSelectedCapabilityIds(value)).toEqual([]);
    });

    it("returns empty array when no capabilities are enabled", () => {
      expect(toSelectedCapabilityIds(NO_TRUST_CAPABILITIES)).toEqual([]);
    });
  });

  describe("fromSelectedCapabilityIds", () => {
    it("sets readFiles when included", () => {
      expect(fromSelectedCapabilityIds(["readFiles"])).toEqual({
        readFiles: true,
        runCommands: false,
      });
    });

    it("always forces runCommands to false regardless of selection", () => {
      expect(fromSelectedCapabilityIds(["runCommands"])).toEqual({
        readFiles: false,
        runCommands: false,
      });
    });

    it("returns no capabilities when selection is empty", () => {
      expect(fromSelectedCapabilityIds([])).toEqual(NO_TRUST_CAPABILITIES);
    });
  });

  describe("getInitialFocusedCapability", () => {
    it("returns readFiles when it is enabled", () => {
      expect(getInitialFocusedCapability({ readFiles: true, runCommands: false })).toBe(
        "readFiles",
      );
    });

    it("returns the first non-disabled capability when readFiles is off", () => {
      expect(getInitialFocusedCapability(NO_TRUST_CAPABILITIES)).toBe("readFiles");
    });
  });

  describe("isFocusableCapability", () => {
    it("returns true for readFiles", () => {
      expect(isFocusableCapability("readFiles")).toBe(true);
    });

    it("returns false for disabled runCommands capability", () => {
      expect(isFocusableCapability("runCommands")).toBe(false);
    });

    it("returns false for null", () => {
      expect(isFocusableCapability(null)).toBe(false);
    });

    it("returns false for unknown id", () => {
      expect(isFocusableCapability("unknown")).toBe(false);
    });
  });

  describe("TRUST_CAPABILITY_OPTIONS", () => {
    it("exposes readFiles as enabled and runCommands as disabled", () => {
      const readFiles = TRUST_CAPABILITY_OPTIONS.find((option) => option.id === "readFiles");
      const runCommands = TRUST_CAPABILITY_OPTIONS.find((option) => option.id === "runCommands");
      expect(readFiles?.disabled).toBe(false);
      expect(runCommands?.disabled).toBe(true);
    });
  });

  describe("getTrustButtonLabel", () => {
    it("reports the saving state", () => {
      expect(getTrustButtonLabel(true, true)).toBe("Saving...");
      expect(getTrustButtonLabel(true, false)).toBe("Saving...");
    });

    it("offers Trust & Continue when repository access is granted", () => {
      expect(getTrustButtonLabel(false, true)).toBe("Trust & Continue");
    });

    it("offers Continue Without Trust when repository access is withheld", () => {
      expect(getTrustButtonLabel(false, false)).toBe("Continue Without Trust");
    });
  });

  describe("TRUST_SECURITY_WARNING", () => {
    it("keeps the unavailable state claim in lockstep with runCommands.disabled", () => {
      const runCommands = TRUST_CAPABILITY_OPTIONS.find((option) => option.id === "runCommands");
      expect(runCommands?.disabled).toBe(true);
      expect(TRUST_SECURITY_WARNING.body).toContain("currently unavailable");
    });
  });
});
