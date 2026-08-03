export interface TransferHistoryItem {
  hash: string;
  to: string;
  amount: string;
  sentAt: string;
}

export const TRANSFER_PAGE_SIZE = 5;

export function transferHistoryKey(address: string): string {
  return `ieum-transfer-history-${address.toLowerCase()}`;
}

export function loadTransferHistory(address: string): TransferHistoryItem[] {
  try {
    const value = JSON.parse(localStorage.getItem(transferHistoryKey(address)) ?? "[]");
    return Array.isArray(value) ? value.slice(0, 100) : [];
  } catch {
    return [];
  }
}

export function saveTransfer(address: string, item: TransferHistoryItem): TransferHistoryItem[] {
  const next = [
    item,
    ...loadTransferHistory(address).filter((current) => current.hash !== item.hash)
  ].slice(0, 100);
  localStorage.setItem(transferHistoryKey(address), JSON.stringify(next));
  return next;
}

export function pageCount(total: number, pageSize = TRANSFER_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function transferPage<T>(items: T[], page: number, pageSize = TRANSFER_PAGE_SIZE): T[] {
  const safePage = Math.min(Math.max(1, page), pageCount(items.length, pageSize));
  return items.slice((safePage - 1) * pageSize, safePage * pageSize);
}
