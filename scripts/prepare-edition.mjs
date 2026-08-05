import { mkdir, writeFile } from "node:fs/promises";

const edition = process.argv[2];
if (!new Set(["light", "normal"]).has(edition)) {
  throw new Error("edition must be light or normal");
}

const environment = edition === "normal"
  ? "VITE_WALLET_EDITION=normal\nVITE_DEFAULT_RPC_URL=http://127.0.0.1:8989\n"
  : "VITE_WALLET_EDITION=light\nVITE_DEFAULT_RPC_URL=https://rpc.ieum.aah.name\n";

await writeFile(".env.production.local", environment);
if (edition === "normal") await mkdir("src-tauri/binaries", { recursive: true });
console.log(`Prepared IEUM Wallet ${edition} edition`);
