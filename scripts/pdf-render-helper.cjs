#!/usr/bin/env node
/**
 * pdf-render-helper.cjs
 *
 * Pipeline subprocess: reads resume JSON from stdin, renders PDF via the same
 * layout as lib/resumePdf.tsx (admin preview + /api/resume/pdf), writes bytes to stdout.
 */

"use strict";

require("ts-node").register({
  transpileOnly: true,
  compilerOptions: {
    module: "commonjs",
    jsx: "react-jsx",
    moduleResolution: "node",
    esModuleInterop: true,
    allowJs: true,
    strict: false,
  },
});

const React = require("react");
const { renderToBuffer } = require("@react-pdf/renderer");
const { ResumePdfDocument } = require("../lib/resumePdf.tsx");

async function main() {
  let inputData = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) {
    inputData += chunk;
  }

  let resume;
  try {
    resume = JSON.parse(inputData);
  } catch (err) {
    process.stderr.write(`❌ Failed to parse resume JSON: ${err.message}\n`);
    process.exit(1);
  }

  try {
    const el = React.createElement(ResumePdfDocument, { resume });
    const pdfBuffer = Buffer.from(await renderToBuffer(el));
    process.stdout.write(pdfBuffer);
  } catch (err) {
    process.stderr.write(`❌ PDF render failed: ${err.message}\n`);
    process.exit(1);
  }
}

main();
