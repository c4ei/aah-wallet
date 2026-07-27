import { invoke } from "@tauri-apps/api/core";

export type UsdtNetwork = "TRON" | "SOLANA" | "BSC";
export type SwapStatus =
  | "WAITING_DEPOSIT"
  | "CONFIRMING"
  | "DEPOSIT_CONFIRMED"
  | "SWAPPED"
  | "WITHDRAWING"
  | "COMPLETED"
  | "FAILED";

export interface NetworkOption {
  id: UsdtNetwork;
  label: string;
  standard: string;
  description: string;
}

export const USDT_NETWORKS: NetworkOption[] = [
  { id: "TRON", label: "TRON", standard: "TRC20", description: "호환성이 높아 기본으로 추천" },
  { id: "SOLANA", label: "Solana", standard: "SPL", description: "일반적으로 매우 낮은 전송 수수료" },
  { id: "BSC", label: "BNB Smart Chain", standard: "BEP20", description: "지원 거래소가 많고 EVM 호환" }
];

export interface DepositSession {
  swapId: string;
  network: UsdtNetwork;
  depositAddress: string;
  memo?: string | null;
  expiresAt: string;
  minimumDeposit: string;
  confirmationsRequired: number;
  status: SwapStatus;
}

export interface SwapQuote {
  quoteId: string;
  swapId: string;
  usdtAmount: string;
  aahPriceKrw: string;
  grossAah: string;
  foundationFeeAah: string;
  networkFeeAah: string;
  minimumReceivedAah: string;
  expiresAt: string;
}

export interface SwapProgress {
  swapId: string;
  status: SwapStatus;
  depositedAmount?: string;
  confirmations?: number;
  txHash?: string;
  failureReason?: string;
}

async function cexCall<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  return invoke<T>("cex_call", {
    path,
    method,
    body: body ?? null
  });
}

export function createDepositSession(network: UsdtNetwork, destinationAahAddress: string) {
  return cexCall<DepositSession>("/api/v1/simple-swap/deposit-address", "POST", {
    asset: "USDT",
    network,
    destinationAahAddress
  });
}

export function getSwapStatus(swapId: string) {
  return cexCall<SwapProgress>(`/api/v1/simple-swap/status/${encodeURIComponent(swapId)}`);
}

export function requestQuote(swapId: string, usdtAmount: string) {
  return cexCall<SwapQuote>("/api/v1/simple-swap/quote", "POST", {
    swapId,
    fromAsset: "USDT",
    toAsset: "AAH",
    amount: usdtAmount
  });
}

export function executeSwap(quoteId: string) {
  return cexCall<SwapProgress>("/api/v1/simple-swap/execute", "POST", { quoteId });
}

export function withdrawAah(swapId: string, destinationAahAddress: string) {
  return cexCall<SwapProgress>("/api/v1/simple-swap/withdraw-aah", "POST", {
    swapId,
    destinationAahAddress
  });
}

export function quoteIsExpired(quote: SwapQuote, now = Date.now()) {
  return Date.parse(quote.expiresAt) <= now;
}

export function validateUsdtAmount(value: string): string {
  const trimmed = value.trim();
  if (!/^(0|[1-9]\d*)(\.\d{1,6})?$/.test(trimmed)) {
    throw new Error("USDT 수량은 소수점 6자리 이하의 숫자로 입력해 주세요.");
  }
  if (Number(trimmed) <= 0) throw new Error("USDT 수량은 0보다 커야 합니다.");
  return trimmed;
}
