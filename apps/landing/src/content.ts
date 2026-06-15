export const PRODUCT_NAME = "Diffgazer";

export const TAGLINE =
  "AI code review that runs on your machine. Local web workspace, local control.";

export const HERO_DESCRIPTION =
  "Run it in a repo to start an embedded localhost server and open the web app. Source remains local until you send a review to your chosen provider; then the diff and prompt go to that provider under its policy.";

export const INSTALL_COMMAND = "npm install -g diffgazer";

export const DOCS_URL = import.meta.env.VITE_DOCS_ORIGIN ?? "https://docs.b4r7.dev";

export const GITHUB_URL = "https://github.com/b4r7x/diffgazer";

export const DOCS_LINK_TEXT = "Documentation";

interface ValueProp {
  title: string;
  body: string;
}

export const VALUE_PROPS: ValueProp[] = [
  {
    title: "Local-first",
    body: "Runs as a CLI on your machine and serves the review workspace from localhost. There is no remote Diffgazer service to deploy.",
  },
  {
    title: "Privacy-respecting",
    body: "Your provider keys are stored locally or read from your environment. Review requests go directly to the model provider you choose.",
  },
  {
    title: "Web review by default",
    body: "The default command opens a local web workspace for onboarding, model selection, diff review, and findings.",
  },
  {
    title: "Provider-agnostic",
    body: "Bring your own model. Swap providers without rewriting your workflow or relearning the tool.",
  },
];

export const SHOWCASE_HEADING = "See the review, not a screenshot of one";

export const SHOWCASE_CAPTION =
  "A real diff rendered in the local review workspace. Use j and k to navigate.";

export const DIFF_STATS = "+5 −2 · 1 hunk";

export const TERMINAL_TITLE = "~/acme-api · local web mode";

export const TERMINAL_OUTPUT = `$ diffgazer
→ Starting embedded server on http://127.0.0.1:3000
→ Opening the local review workspace
Ready. Press Ctrl+C to stop.`;

export const INSTALL_HEADING = "Install";

export const INSTALL_CAPTION =
  "Node 22+. Install the published CLI, then run diffgazer from inside a repository with changes.";

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
