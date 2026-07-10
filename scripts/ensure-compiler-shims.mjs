import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const binDir = path.join(root, "node_modules", ".bin");

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

async function replaceShim(file, content, mode) {
  await rm(file, { force: true });
  await writeFile(file, content, "utf8");
  if (mode !== undefined) await chmod(file, mode);
}

await mkdir(binDir, { recursive: true });

// @typescript/typescript6 depends on the classic compiler as @typescript/old.
// npm may allow that dependency's `tsc` bin to overwrite TypeScript 7's root
// `tsc` shim. Recreate the stable shim deterministically on every install.
const unixShim = `#!/bin/sh
basedir=$(dirname "$(echo "$0" | sed -e 's,\\\\,/,g')")
exec node "$basedir/../typescript/bin/tsc" "$@"
`;
const cmdShim = `@ECHO off\r\nSETLOCAL\r\nnode "%~dp0\\..\\typescript\\bin\\tsc" %*\r\n`;
const ps1Shim = `#!/usr/bin/env pwsh\n$basedir=Split-Path $MyInvocation.MyCommand.Definition -Parent\n& node "$basedir/../typescript/bin/tsc" $args\nexit $LASTEXITCODE\n`;

await replaceShim(path.join(binDir, "tsc"), unixShim, 0o755);
await replaceShim(path.join(binDir, "tsc.cmd"), cmdShim);
await replaceShim(path.join(binDir, "tsc.ps1"), ps1Shim);

const stablePackage = await readJson(path.join(root, "node_modules", "typescript", "package.json"));
const classicPackage = await readJson(path.join(root, "node_modules", "@typescript", "old", "package.json"));

function runVersion(name) {
  const executable = path.join(binDir, `${name}${process.platform === "win32" ? ".cmd" : ""}`);
  const result = spawnSync(executable, ["--version"], {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32"
  });

  if (result.error || result.status !== 0) {
    const details = result.error?.message ?? result.stderr ?? result.stdout;
    throw new Error(`Failed to run ${name}: ${details}`);
  }

  return result.stdout.trim().replace(/^Version\s+/, "");
}

const selectedStable = runVersion("tsc");
const selectedClassic = runVersion("tsc6");

if (selectedStable !== stablePackage.version) {
  throw new Error(`tsc resolved to ${selectedStable}; expected stable TypeScript ${stablePackage.version}`);
}
if (selectedClassic !== classicPackage.version) {
  throw new Error(`tsc6 resolved to ${selectedClassic}; expected classic TypeScript ${classicPackage.version}`);
}

console.log(`Compiler shims verified: tsc=${selectedStable}, tsc6=${selectedClassic}`);
