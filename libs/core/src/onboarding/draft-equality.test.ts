import { describe, expect, it } from "vitest";
import { PRODUCT_REGISTRY } from "../providers/product-registry.js";
import type { RunnableProductId, TransportFamily } from "../schemas/config/index.js";
import { getInitialWizardData, type OnboardingDraft } from "./defaults.js";
import { areDraftsEqual } from "./draft-equality.js";

const PRODUCT_REPRESENTATIVES: ReadonlyArray<readonly [TransportFamily, RunnableProductId]> = [
  ["hosted-api", "gemini"],
  ["hosted-api", "zai"],
];

function acceptDraftNotice(draft: OnboardingDraft): OnboardingDraft {
  const notice = PRODUCT_REGISTRY[draft.plan.productId].notice;
  return {
    ...draft,
    acknowledgement: {
      status: "accepted",
      noticeId: notice.id,
      noticeVersion: notice.noticeVersion,
      acceptedAt: "2026-07-31T12:00:00.000Z",
    },
  };
}

describe("areDraftsEqual", () => {
  it.each(PRODUCT_REPRESENTATIVES)("treats unchanged %s drafts as equal", (family, productId) => {
    const draft = getInitialWizardData(productId);

    expect(draft.configurationInput.transportFamily).toBe(family);
    expect(areDraftsEqual(draft, getInitialWizardData(productId))).toBe(true);
  });

  it.each(PRODUCT_REPRESENTATIVES)("treats accepted %s drafts as equal", (_family, productId) => {
    const draft = acceptDraftNotice(getInitialWizardData(productId));

    expect(draft.acknowledgement.status).toBe("accepted");
    expect(areDraftsEqual(draft, acceptDraftNotice(getInitialWizardData(productId)))).toBe(true);
  });

  it.each(PRODUCT_REPRESENTATIVES)("treats a changed %s model as unequal", (_f, productId) => {
    const draft = getInitialWizardData(productId);

    expect(areDraftsEqual(draft, { ...draft, selectedModelId: "some-other-model" })).toBe(false);
  });

  it("treats a changed billing pool as unequal, even under the same model id", () => {
    const draft = getInitialWizardData("opencode-zen");

    expect(
      areDraftsEqual(
        { ...draft, selectedModelId: "deepseek-v4-flash", selectedModelEndpoint: null },
        {
          ...draft,
          selectedModelId: "deepseek-v4-flash",
          selectedModelEndpoint: "https://opencode.ai/zen/go/v1",
        },
      ),
    ).toBe(false);
  });

  it("reports drafts that differ only in acknowledgement status as unequal", () => {
    const draft = getInitialWizardData("gemini");

    expect(areDraftsEqual(draft, acceptDraftNotice(draft))).toBe(false);
  });
});
