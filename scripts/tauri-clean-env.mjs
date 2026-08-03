import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

function removeSnapEntries(value) {
  if (!value) {
    return undefined;
  }

  const cleaned = value
    .split(path.delimiter)
    .filter((entry) => entry && !entry.startsWith("/snap/"))
    .join(path.delimiter);

  return cleaned || undefined;
}

function createTauriEnvironment(source = process.env) {
  const environment = { ...source };

  if (process.platform === "linux") {
    const libraryPath = removeSnapEntries(environment.LD_LIBRARY_PATH);
    if (libraryPath) {
      environment.LD_LIBRARY_PATH = libraryPath;
    } else {
      delete environment.LD_LIBRARY_PATH;
    }

    if (environment.LD_PRELOAD?.includes("/snap/")) {
      delete environment.LD_PRELOAD;
    }
  }

  return environment;
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, "..");
const executable = path.join(
  projectDirectory,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "tauri.cmd" : "tauri",
);

const child = spawn(executable, process.argv.slice(2), {
  cwd: projectDirectory,
  env: createTauriEnvironment(),
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("error", (error) => {
  console.error(`Tauri 실행 실패: ${error.message}`);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});
