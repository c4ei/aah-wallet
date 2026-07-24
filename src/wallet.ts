import { HDNodeWallet, Mnemonic, Wallet, formatEther, isAddress, parseEther } from "ethers";

export const CHAIN_ID = 21004;
export const HD_PATH = "m/44'/60'/0'/0/0";
export const MAX_TRANSFER_VALUE = (1n << 64n) - 1n;

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
  // 현재 aah-chain 거래 모델의 amount가 u64라 한 번에 약 18.44 AAH까지만 가능합니다.
  if (value > MAX_TRANSFER_VALUE) {
    throw new Error("현재 체인에서는 한 번에 약 18.44 AAH까지만 보낼 수 있습니다.");
  }
  return value;
}

export function formatAah(value: bigint): string {
  const text = formatEther(value);
  return `${Number(text).toLocaleString("ko-KR", { maximumFractionDigits: 8 })} AAH`;
}
