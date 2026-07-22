export const RELEASE_WORKFLOW_PATH = ".github/workflows/release.yml";
export const RELEASE_READINESS_WORKFLOW_PATH = ".github/workflows/release-readiness.yml";
export const DEPLOY_WORKFLOW_PATH = ".github/workflows/deploy.yml";
export const PACKAGE_GOVERNANCE_PATH = "PACKAGE_GOVERNANCE.md";

export const stripExpressionDelimiters = (condition) =>
  condition
    .replace(/^\s*\$\{\{\s*/, "")
    .replace(/\s*\}\}\s*$/, "")
    .trim();
