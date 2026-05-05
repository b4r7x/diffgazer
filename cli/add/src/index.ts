#!/usr/bin/env node

import { createCli, runCli } from "@diffgazer/registry/cli";
import { VERSION } from "./context.js";
import { initCommand } from "./commands/init.js";
import { addCommand } from "./commands/add.js";
import { listCommand } from "./commands/list.js";
import { diffCommand } from "./commands/diff.js";
import { removeCommand } from "./commands/remove.js";

function normalizeShadcnStyleArgs(argv: string[]): string[] {
  const firstArg = argv[2];
  if (!firstArg || firstArg.startsWith("-")) return argv;
  if (!/^(ui|keys)\/[^/]+$/.test(firstArg)) return argv;
  return [argv[0]!, argv[1]!, "add", ...argv.slice(2)];
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

process.argv = normalizeShadcnStyleArgs(process.argv);
runCli(program);
