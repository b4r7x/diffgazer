#!/usr/bin/env node

import { Command } from "commander";
import { DEFAULT_HOST } from "@repo/core";
import { runCommand } from "./commands/run.js";
import { serveCommand } from "./commands/serve.js";
import { reviewCommand } from "./commands/review.js";
import { webCommand } from "./commands/web.js";

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
  .option("-H, --hostname <hostname>", "Server hostname", DEFAULT_HOST)
  .option("-c, --continue", "Continue most recent session")
  .option("-r, --resume [id]", "Resume specific session (or show picker)")
  .option("--project <path>", "Project directory path (defaults to current directory)")
  .action(runCommand);

program
  .command("serve")
  .description("Start headless server")
  .option("-p, --port <port>", "Server port", DEFAULT_PORT)
  .option("-H, --hostname <hostname>", "Server hostname", DEFAULT_HOST)
  .action(serveCommand);

program
  .command("review")
  .description("AI-powered code review")
  .option("-p, --port <port>", "Server port", DEFAULT_PORT)
  .option("-H, --hostname <hostname>", "Server hostname", DEFAULT_HOST)
  .option("-s, --staged", "Review staged changes (default)")
  .option("-u, --unstaged", "Review unstaged changes")
  .option("-f, --files <files...>", "Review only specific files (comma-separated or multiple -f flags)")
  .option("--lens <lenses>", "Comma-separated lens IDs (correctness,security,performance,simplicity,tests)")
  .option("--profile <profile>", "Review profile (quick,strict,perf,security)")
  .option("-l, --list", "List review history")
  .option("-r, --resume <id>", "Resume a saved review by ID")
  .option("--pick", "Pick files to review interactively")
  .option("--pr", "PR review mode (non-interactive, for CI)")
  .option("-o, --output <file>", "Output file for annotations (default: annotations.json)")
  .action(reviewCommand);

program
  .command("web")
  .description("Open Stargazer Web UI")
  .option("-p, --port <port>", "Web UI port", "5173")
  .option("--server-port <port>", "API server port", "7860")
  .action(webCommand);

await program.parseAsync();
