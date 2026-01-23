#!/usr/bin/env node

import { Command } from "commander";
import { runCommand } from "./commands/run.js";
import { serveCommand } from "./commands/serve.js";

const DEFAULT_PORT = "3000";

const program = new Command();

program
  .name("stargazer")
  .description("Local AI coding tool")
  .version("0.1.0");

program
  .command("run")
  .description("Start interactive TUI")
  .option("-p, --port <port>", "Server port", DEFAULT_PORT)
  .option("-H, --hostname <hostname>", "Server hostname", "localhost")
  .option("-c, --continue", "Continue most recent session")
  .option("-r, --resume [id]", "Resume specific session (or show picker)")
  .action(runCommand);

program
  .command("serve")
  .description("Start headless server")
  .option("-p, --port <port>", "Server port", DEFAULT_PORT)
  .option("-H, --hostname <hostname>", "Server hostname", "localhost")
  .action(serveCommand);

await program.parseAsync();
