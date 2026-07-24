export const REWARD_COOLDOWN_MS = 4 * 60 * 60 * 1000;

export interface RewardStatus {
  lastConfirmedAt?: string;
  nextEligibleAt?: string;
  dailyConfirmedCount: number;
  serverNow: string;
  pendingTxHash?: string;
}

export function nextRewardAt(lastConfirmedAt?: string): Date | null {
  if (!lastConfirmedAt) return null;
  const value = new Date(lastConfirmedAt);
  if (Number.isNaN(value.getTime())) throw new Error("보상 서버가 잘못된 시각을 반환했습니다.");
  return new Date(value.getTime() + REWARD_COOLDOWN_MS);
}

export function remainingRewardMs(status: RewardStatus): number {
  const next = status.nextEligibleAt
    ? new Date(status.nextEligibleAt)
    : nextRewardAt(status.lastConfirmedAt);
  if (!next) return 0;
  return Math.max(0, next.getTime() - new Date(status.serverNow).getTime());
}

export function formatRemaining(milliseconds: number): string {
  if (milliseconds <= 0) return "지금 참여 가능";
  const totalMinutes = Math.ceil(milliseconds / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}시간 ${minutes}분 후 참여 가능`;
}

// 광고 서버가 준비되기 전 UI와 4시간 정책을 검증하기 위한 개발용 상태입니다.
export function createDevelopmentRewardStatus(lastConfirmedAt?: string): RewardStatus {
  const serverNow = new Date();
  return {
    lastConfirmedAt,
    nextEligibleAt: nextRewardAt(lastConfirmedAt)?.toISOString(),
    dailyConfirmedCount: lastConfirmedAt ? 1 : 0,
    serverNow: serverNow.toISOString()
  };
}
