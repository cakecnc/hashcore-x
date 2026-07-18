import { spawn } from "node:child_process";

const processes = [
  start("runner", ["run", "runner"]),
  start("web", ["run", "dev:web"]),
];

let stopping = false;

for (const { name, child } of processes) {
  child.once("error", (error) => {
    console.error(`[dev:${name}] ${error.message}`);
    stopAll("SIGTERM", 1);
  });
  child.once("exit", (code, signal) => {
    if (stopping) return;
    console.error(`[dev:${name}] exited (${signal ?? code ?? "unknown"})`);
    stopAll("SIGTERM", code ?? 1);
  });
}

process.once("SIGINT", () => stopAll("SIGINT", 0));
process.once("SIGTERM", () => stopAll("SIGTERM", 0));

function start(name, argumentsList) {
  return {
    name,
    child: spawn("pnpm", argumentsList, {
      cwd: process.cwd(),
      env: process.env,
      shell: false,
      stdio: "inherit",
    }),
  };
}

function stopAll(signal, exitCode) {
  if (stopping) return;
  stopping = true;
  process.exitCode = exitCode;
  for (const { child } of processes) {
    if (child.exitCode === null && child.signalCode === null) child.kill(signal);
  }
}
