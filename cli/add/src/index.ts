#!/usr/bin/env node

import { createCli, runCli } from "@diffgazer/registry/cli";
import { addCommand } from "./commands/add/command.js";
import { diffCommand } from "./commands/diff.js";
import { initCommand } from "./commands/init.js";
import { listCommand } from "./commands/list.js";
import { removeCommand } from "./commands/remove.js";
import { VERSION } from "./context.js";

function normalizeShadcnStyleArgs(argv: string[]): string[] {
  const userArgs = argv.slice(2);
  const firstArg = userArgs[0];
  if (!firstArg || firstArg.startsWith("-")) return userArgs;
  if (!/^(ui|keys)\/[^/]+$/.test(firstArg)) return userArgs;
  return ["add", ...userArgs];
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
