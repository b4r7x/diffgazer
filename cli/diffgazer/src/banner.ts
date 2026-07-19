import { getFigletText } from "./lib/get-figlet";

const BANNER_TEXT = "DIFFGAZER";
const FIGLET_BANNER_COLUMNS = 64;

export function printDiffgazerBanner(columns = process.stdout.columns): void {
  const banner =
    columns !== undefined && columns >= FIGLET_BANNER_COLUMNS ? getFigletText(BANNER_TEXT) : null;
  console.log(banner ?? BANNER_TEXT);
  console.log();
}
