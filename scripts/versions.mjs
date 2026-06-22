import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWindows = process.platform === "win32";

function runBinary(name, args) {
  const executable = path.join(root, "node_modules", ".bin", `${name}${isWindows ? ".cmd" : ""}`);
  const result = spawnSync(executable, args, {
    cwd: root,
    encoding: "utf8",
    shell: isWindows
  });

  if (result.error || result.status !== 0) {
    const details = result.error?.message ?? result.stderr ?? result.stdout;
    throw new Error(`Failed to run ${name}: ${details}`);
  }

  return result.stdout.trim();
}

console.log(`Node: ${process.version}`);
console.log(`OS: ${os.type()} ${os.release()} (${os.arch()})`);
console.log(`CPU: ${os.cpus()[0]?.model ?? "unknown"} x ${os.cpus().length}`);
console.log(`TypeScript 6: ${runBinary("tsc6", ["--version"])}`);
console.log(`TypeScript 7: ${runBinary("tsc", ["--version"])}`);
