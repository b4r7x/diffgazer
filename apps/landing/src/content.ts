export const PRODUCT_NAME = "diffgazer";

export const TAGLINE =
  "AI code review for your terminal. Local-first. Privacy-respecting.";

export const HERO_DESCRIPTION =
  "Point it at a branch, get a structured review in your terminal. Your code and your model keys stay on your machine.";

export const INSTALL_COMMAND = "npm install -g diffgazer";

export const DOCS_URL =
  import.meta.env.VITE_DOCS_ORIGIN ?? "https://docs.b4r7.dev";

export const GITHUB_URL = "https://github.com/b4r7x/diffgazer";

export const DOCS_LINK_TEXT = "Documentation";

export interface ValueProp {
  title: string;
  body: string;
}

export const VALUE_PROPS: ValueProp[] = [
  {
    title: "Local-first",
    body: "Runs as a CLI on your machine. No server to deploy, no diff uploaded to a dashboard you do not control.",
  },
  {
    title: "Privacy-respecting",
    body: "Your source and your provider keys stay local. diffgazer talks to your chosen model, nothing else.",
  },
  {
    title: "Terminal-native review",
    body: "Reads a unified diff and returns findings inline, with j/k hunk navigation and keyboard-first flow.",
  },
  {
    title: "Provider-agnostic",
    body: "Bring your own model. Swap providers without rewriting your workflow or relearning the tool.",
  },
];

export const SHOWCASE_HEADING = "See the review, not a screenshot of one";

export const SHOWCASE_CAPTION =
  "A real diff rendered by the same component the CLI ships. Use j and k to move between hunks.";

export const DIFF_STATS = "+5 −2 · 1 hunk";

export const TERMINAL_TITLE = "~/acme-api · zsh";

export const TERMINAL_OUTPUT = `$ diffgazer review --base main
✓ Parsed 1 changed file (src/utils/score.ts)
→ 1 finding · weights param is unvalidated
Done in 1.4s`;

export const INSTALL_HEADING = "Install";

export const INSTALL_CAPTION = "Node 18+. One global binary, then run it in any repo.";

// A short, self-explanatory unified diff rendered by <DiffView>. It tells a
// tiny story on its own: a scoring helper gains a `weights` argument and folds
// findings instead of counting them.
export const SAMPLE_PATCH = `--- a/src/utils/score.ts
+++ b/src/utils/score.ts
@@ -1,7 +1,10 @@
 import type { Review } from "../types"

-export function calculateScore(review: Review): number {
-  return review.findings.length * 10
+export function calculateScore(review: Review, weights: Record<string, number>): number {
+  return review.findings.reduce((total, finding) => {
+    const weight = weights[finding.severity] ?? 1
+    return total + weight
+  }, 0)
 }

 export function isPassingScore(score: number): boolean {`;
