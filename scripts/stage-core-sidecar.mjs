import { execFileSync } from "node:child_process";
import { chmod, copyFile, mkdir } from "node:fs/promises";

const triple = execFileSync("rustc", ["--print", "host-tuple"], { encoding: "utf8" }).trim();
if (!triple) throw new Error("Rust host target triple was not detected");
const executable = process.platform === "win32" ? "ieum-chain.exe" : "ieum-chain";
const suffix = process.platform === "win32" ? ".exe" : "";
const source = new URL(`../ieum-chain-source/target/release/${executable}`, import.meta.url);
const directory = new URL("../src-tauri/binaries/", import.meta.url);
const destination = new URL(`ieum-chain-${triple}${suffix}`, directory);
await mkdir(directory, { recursive: true });
await copyFile(source, destination);
if (process.platform !== "win32") await chmod(destination, 0o755);
console.log(`Staged IEUM Core sidecar for ${triple}`);
