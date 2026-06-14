#!/usr/bin/env node
/** @deprecated Use `npm run job:retailor` */
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "retailor-below-target.mjs");
const child = spawn(process.execPath, [script], { stdio: "inherit", env: process.env });
child.on("exit", (code) => process.exit(code ?? 0));
