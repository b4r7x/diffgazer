#!/usr/bin/env node

import { createCli, runCli } from "@diffgazer/registry/cli";
import { addCommand } from "./commands/add/command.js";
import { diffCommand } from "./commands/diff.js";
import { initCommand } from "./commands/init/command.js";
import { listCommand } from "./commands/list.js";
import { removeCommand } from "./commands/remove/command.js";
import { VERSION } from "./context.js";

// Boolean global options may precede the shorthand item, so shorthand detection
// skips them before inspecting the first positional token. Keep in sync if a
// value-taking global option is added.
const GLOBAL_BOOLEAN_FLAGS = new Set(["-s", "--silent"]);
const SHORTHAND_ITEM_RE = /^(ui|keys)\/[^/]+$/;

function normalizeShadcnStyleArgs(argv: string[]): string[] {
  const userArgs = argv.slice(2);
  let index = 0;
  while (index < userArgs.length && GLOBAL_BOOLEAN_FLAGS.has(userArgs[index] ?? "")) {
    index += 1;
  }
  const candidate = userArgs[index];
  if (!candidate || !SHORTHAND_ITEM_RE.test(candidate)) return userArgs;
  return [...userArgs.slice(0, index), "add", ...userArgs.slice(index)];
}

// Subcommand `--help` is the offline discovery path for both users and agents,
// so every command carries at least one copy-pasteable invocation.
const EXAMPLES: Record<string, string[]> = {
  init: [
    "dgadd init",
    "dgadd init --yes --skip-install",
    "dgadd init --components-dir src/ui --allow-missing-alias --import-alias-prefix @ --source-dir src",
  ],
  add: [
    "dgadd add ui/button",
    "dgadd add ui/select keys/navigation --integration copy --yes",
    "dgadd add ui/dialog --dry-run",
  ],
  list: ["dgadd list", "dgadd list --installed --json", "dgadd list --all"],
  diff: ["dgadd diff", "dgadd diff ui/button keys/navigation"],
  remove: ["dgadd remove ui/button --yes", "dgadd remove keys/navigation --dry-run"],
};

// The registered command set and the interactive menu rows come from this one
// declaration: a menu value is read off its own command, so a rename or removal
// cannot leave a menu row pointing at a command the program never registered.
const COMMANDS = [
  { command: initCommand, label: "Init", hint: "Initialize dgadd in your project" },
  { command: addCommand, label: "Add", hint: "Add ui/* components or keys/* hooks" },
  { command: listCommand, label: "List", hint: "List available ui/* and keys/* items" },
  { command: diffCommand, label: "Diff", hint: "Compare local files with registry versions" },
  { command: removeCommand, label: "Remove", hint: "Remove installed ui/* or keys/* items" },
];

for (const { command } of COMMANDS) {
  const examples = EXAMPLES[command.name()] ?? [];
  command.addHelpText("after", `\nExamples:\n${examples.map((line) => `  ${line}`).join("\n")}\n`);
}

const program = createCli({
  name: "dgadd",
  displayName: "DIFFGAZER ADD",
  description: "Install Diffgazer UI components and keys hooks into your React project",
  version: VERSION,
  commands: COMMANDS.map(({ command }) => command),
  menuItems: COMMANDS.map(({ command, label, hint }) => ({ value: command.name(), label, hint })),
});

runCli(program, normalizeShadcnStyleArgs(process.argv));
