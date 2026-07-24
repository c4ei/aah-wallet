import { describe, expect, it } from "vitest";
import { formatRemaining, nextRewardAt, remainingRewardMs } from "./rewards";

describe("4시간 광고 보상", () => {
  it("마지막 확정 시각부터 정확히 4시간 뒤를 계산한다", () => {
    expect(nextRewardAt("2026-07-24T00:00:00.000Z")?.toISOString())
      .toBe("2026-07-24T04:00:00.000Z");
  });

  it("서버 시각을 기준으로 남은 시간을 계산한다", () => {
    expect(remainingRewardMs({
      lastConfirmedAt: "2026-07-24T00:00:00.000Z",
      dailyConfirmedCount: 1,
      serverNow: "2026-07-24T03:30:00.000Z"
    })).toBe(30 * 60 * 1000);
    expect(formatRemaining(30 * 60 * 1000)).toBe("0시간 30분 후 참여 가능");
  });
});
