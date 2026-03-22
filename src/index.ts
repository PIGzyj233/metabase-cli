#!/usr/bin/env node
import { Command } from "commander";

const program = new Command();

program
  .name("mb")
  .description("Metabase CLI — query data from the terminal")
  .version("0.1.0");

program.parse();
