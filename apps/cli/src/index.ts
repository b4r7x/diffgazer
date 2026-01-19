#!/usr/bin/env node

import { Command } from "commander";
import { runCommand } from "./commands/run.js";
import { serveCommand } from "./commands/serve.js";

const program = new Command();

program
  .name("stargazer")
  .description("Local AI coding tool")
  .version("0.1.0");

program
  .command("run")
  .description("Start interactive TUI")
  .option("-p, --port <port>", "Server port", "3000")
  .option("-H, --hostname <hostname>", "Server hostname", "localhost")
  .action(runCommand);

program
  .command("serve")
  .description("Start headless server")
  .option("-p, --port <port>", "Server port", "3000")
  .option("-H, --hostname <hostname>", "Server hostname", "localhost")
  .action(serveCommand);

await program.parseAsync();
