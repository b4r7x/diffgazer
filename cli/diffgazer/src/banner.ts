import { getFigletText } from "./lib/get-figlet";

const BANNER_TEXT = "DIFFGAZER";

export function printDiffgazerBanner(): void {
  console.log(getFigletText(BANNER_TEXT) ?? BANNER_TEXT);
  console.log();
}
