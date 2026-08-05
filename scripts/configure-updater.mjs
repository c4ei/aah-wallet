import { readFile, writeFile } from "node:fs/promises";

const bundledPublicKeyPath = new URL("../src-tauri/updater-public.key", import.meta.url);
const publicKey = process.env.TAURI_UPDATER_PUBLIC_KEY?.trim()
  || (await readFile(bundledPublicKeyPath, "utf8")).trim();

const configPath = new URL("../src-tauri/tauri.conf.json", import.meta.url);
const config = JSON.parse(await readFile(configPath, "utf8"));
if (config.plugins?.updater?.pubkey !== "__IEUM_UPDATER_PUBLIC_KEY__") {
  throw new Error("Updater public-key placeholder was not found");
}

config.plugins.updater.pubkey = publicKey;
await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
