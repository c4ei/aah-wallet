import { readFile } from "node:fs/promises";

const displayVersion = process.env.DISPLAY_VERSION?.trim();
if (!displayVersion) throw new Error("DISPLAY_VERSION is required");

const parts = displayVersion.split(".");
if (parts.length !== 4 || parts.some((part) => !/^\d+$/.test(part))) {
  throw new Error(`DISPLAY_VERSION must use A.B.C.D format: ${displayVersion}`);
}

const internalVersion = `${parts[0]}.${parts[1]}.${parts[2]}-${parts[3]}`;
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const tauriConfig = JSON.parse(await readFile("src-tauri/tauri.conf.json", "utf8"));
const cargoToml = await readFile("src-tauri/Cargo.toml", "utf8");
const cargoVersion = cargoToml.match(/^version\s*=\s*"([^"]+)"/m)?.[1];

const versions = {
  "package.json": packageJson.version,
  "src-tauri/tauri.conf.json": tauriConfig.version,
  "src-tauri/Cargo.toml": cargoVersion,
};

for (const [file, actual] of Object.entries(versions)) {
  if (actual !== internalVersion) {
    throw new Error(`${file}: expected ${internalVersion}, found ${actual ?? "missing"}`);
  }
}

console.log(`Release version validated: ${displayVersion} (${internalVersion})`);
