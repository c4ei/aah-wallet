import { HDNodeWallet, Mnemonic, Wallet, formatEther, isAddress, parseEther } from "ethers";

export const CHAIN_ID = 21004;
export const EXPECTED_GENESIS_HASH = "0x41cfb669940d7244c1f5d77ef0c12ff3d4dcf90ad7734a7cc42e5c8421eee6a7";
export const REQUIRED_PROTOCOL_VERSION = 2;
export const HD_PATH = "m/44'/60'/0'/0/0";

export function createWallet() {
  const wallet = Wallet.createRandom();
  return {
    wallet,
    mnemonic: wallet.mnemonic?.phrase ?? "",
    privateKey: wallet.privateKey
  };
}

export function restoreFromMnemonic(words: string): HDNodeWallet {
  const phrase = words.trim().toLowerCase().replace(/\s+/g, " ");
  if (!Mnemonic.isValidMnemonic(phrase)) throw new Error("올바른 BIP-39 SEED가 아닙니다.");
  return HDNodeWallet.fromPhrase(phrase, undefined, HD_PATH);
}

export function restoreFromPrivateKey(key: string): Wallet {
  const normalized = key.trim().startsWith("0x") ? key.trim() : `0x${key.trim()}`;
  return new Wallet(normalized);
}

export function validateTransfer(to: string, amount: string) {
  if (!isAddress(to)) throw new Error("받는 주소가 올바르지 않습니다.");
  const value = parseEther(amount);
  if (value <= 0n) throw new Error("보낼 수량은 0보다 커야 합니다.");
  return value;
}

export function formatAah(value: bigint): string {
  const text = formatEther(value);
  return `${Number(text).toLocaleString("ko-KR", { maximumFractionDigits: 8 })} IEUM`;
}
