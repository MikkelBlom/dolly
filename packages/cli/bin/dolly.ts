#!/usr/bin/env node
// Entry point for the `dolly` command (Node 24 runs TypeScript directly).
import { main } from "../src/main.ts";
process.exitCode = await main(process.argv.slice(2));
