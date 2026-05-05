import { LensIdSchema, type LensId } from "@diffgazer/core/schemas/review";

const FALLBACK_LENSES: LensId[] = ["correctness", "security", "performance", "simplicity", "tests"];

export function resolveDefaultLenses(rawLenses: string[] | undefined): LensId[] {
  const parsed =
    rawLenses?.filter(
      (lens): lens is LensId => LensIdSchema.safeParse(lens).success,
    ) ?? [];
  return parsed.length > 0 ? parsed : FALLBACK_LENSES;
}
