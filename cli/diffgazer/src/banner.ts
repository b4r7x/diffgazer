import { getFigletText } from "@diffgazer/core/get-figlet";

const BANNER_TEXT = "DIFFGAZER";

export function getDiffgazerBanner(): string {
  return getFigletText(BANNER_TEXT) ?? BANNER_TEXT;
}

export function printDiffgazerBanner(): void {
  console.log(getDiffgazerBanner());
  console.log();
}
