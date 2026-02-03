#!/usr/bin/env node

import React from "react";
import { render } from "ink";
import { App } from "./app/index.js";
import { CliMode } from "./types/cli.js";

function parseCliMode(args: string[]): CliMode {
  return args.includes("--dev") ? "dev" : "prod";
}

const mode = parseCliMode(process.argv.slice(2));

render(<App mode={mode} />, { exitOnCtrlC: false });
