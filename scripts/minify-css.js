#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const cssDir = path.join(root, "src", "public", "styles");

for (const file of fs.readdirSync(cssDir)) {
  if (!file.endsWith(".css")) {
    continue;
  }
  const filePath = path.join(cssDir, file);
  const source = fs.readFileSync(filePath, "utf-8");
  const minified = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([{}:;,])\s*/g, "$1")
    .trim();
  fs.writeFileSync(filePath, minified, "utf-8");
  console.log(`Minified ${file}`);
}
