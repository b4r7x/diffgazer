import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkSecurityReportingChannelsAgree,
  checkSurfaceEnvExampleKeysStayInRootExample,
  documentedEnvKeys,
} from "./docs-drift.mjs";
import { createConformingFixture, resultByName, runFixture, writeText } from "./fixture.mjs";

test("documentedEnvKeys collects active and commented optional variables", () => {
  const keys = documentedEnvKeys("# OPTIONAL=1\nACTIVE=2\n");
  assert.deepEqual([...keys].sort(), ["ACTIVE", "OPTIONAL"]);
});

test("surface env.example keys reject variables absent from the root example", () => {
  const root = createConformingFixture();
  writeText(root, "apps/landing/.env.example", "ORPHAN_ONLY=1\nVITE_SURFACE=1\n");

  const result = resultByName(
    runFixture(root, { checks: [checkSurfaceEnvExampleKeysStayInRootExample] }),
    "surface env.example keys stay in root .env.example",
  );

  assert.equal(result.ok, false);
  assert.match(result.details, /apps\/landing\/\.env\.example.*ORPHAN_ONLY/);
});

const ROOT_REPORTING_POLICY =
  "Report through https://github.com/b4r7x/diffgazer/security/advisories/new or email b4r7dev@gmail.com.\n";
const PUBLISHABLE_SECURITY_DIRS = ["cli/add", "cli/diffgazer", "libs/keys", "libs/ui"];

function writeReportingPolicyEverywhere(root, policy = ROOT_REPORTING_POLICY) {
  writeText(root, "SECURITY.md", ROOT_REPORTING_POLICY);
  writeText(root, "SUPPORT.md", policy);
  for (const dir of PUBLISHABLE_SECURITY_DIRS) {
    writeText(root, `${dir}/SECURITY.md`, policy);
    writeText(root, `${dir}/SUPPORT.md`, policy);
  }
}

const ADVISORY_ONLY = "Report through https://github.com/b4r7x/diffgazer/security/advisories/new\n";

const SECURITY_PARITY_CASES = [
  {
    name: "fails when a package omits a root reporting channel",
    mutate: (root) => {
      for (const dir of PUBLISHABLE_SECURITY_DIRS) {
        writeText(root, `${dir}/SECURITY.md`, ADVISORY_ONLY);
      }
    },
    ok: false,
  },
  {
    name: "fails when a support doc introduces an off-policy channel",
    mutate: (root) =>
      writeText(
        root,
        "libs/keys/SUPPORT.md",
        "Report through https://github.com/b4r7x/diffgazer/security/advisories/new or email rogue@example.com.\n",
      ),
    ok: false,
  },
  {
    name: "allows a support doc to reference a subset of root channels",
    mutate: (root) => writeText(root, "libs/keys/SUPPORT.md", ADVISORY_ONLY),
    ok: true,
  },
  {
    name: "fails when a package README Security link omits a root channel",
    mutate: (root) =>
      writeText(
        root,
        "libs/ui/README.md",
        "## Repository metadata\n\n- **Security:** https://github.com/b4r7x/diffgazer/security/advisories/new\n",
      ),
    ok: false,
  },
  {
    name: "fails when a package README Security link introduces an off-policy channel",
    mutate: (root) =>
      writeText(
        root,
        "libs/ui/README.md",
        "## Repository metadata\n\n- **Security:** https://github.com/b4r7x/diffgazer/security/advisories/new or rogue@example.com\n",
      ),
    ok: false,
  },
  {
    name: "passes when a package README Security link carries each root channel",
    mutate: (root) =>
      writeText(
        root,
        "libs/ui/README.md",
        "## Repository metadata\n\n- **Security:** https://github.com/b4r7x/diffgazer/security/advisories/new or b4r7dev@gmail.com\n",
      ),
    ok: true,
  },
];

for (const { name, mutate, ok } of SECURITY_PARITY_CASES) {
  test(`security reporting parity ${name}`, () => {
    const root = createConformingFixture();
    writeReportingPolicyEverywhere(root);
    mutate(root);

    const result = resultByName(
      runFixture(root, { checks: [checkSecurityReportingChannelsAgree] }),
      "security and support reporting channels match root policy",
    );

    assert.equal(result.ok, ok);
  });
}
