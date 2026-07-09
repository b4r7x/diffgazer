#!/usr/bin/env node

import { createCli, runCli } from "@diffgazer/registry/cli";
import { addCommand } from "./commands/add/command.js";
import { diffCommand } from "./commands/diff.js";
import { initCommand } from "./commands/init.js";
import { listCommand } from "./commands/list.js";
import { removeCommand } from "./commands/remove.js";
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

const program = createCli({
  name: "dgadd",
  displayName: "DIFFGAZER ADD",
  description: "Install Diffgazer UI components and keys hooks into your React project",
  version: VERSION,
  commands: [initCommand, addCommand, listCommand, diffCommand, removeCommand],
  menuItems: [
    { value: "init", label: "Init", hint: "Initialize dgadd in your project" },
    { value: "add", label: "Add", hint: "Add ui/* components or keys/* hooks" },
    { value: "list", label: "List", hint: "List available ui/* and keys/* items" },
    { value: "diff", label: "Diff", hint: "Compare local files with registry versions" },
    { value: "remove", label: "Remove", hint: "Remove installed ui/* or keys/* items" },
  ],
});

runCli(program, normalizeShadcnStyleArgs(process.argv));
