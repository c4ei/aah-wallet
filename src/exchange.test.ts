import { describe, expect, it } from "vitest";
import { quoteIsExpired, validateUsdtAmount } from "./exchange";

describe("USDT 간편 교환", () => {
  it("USDT 6자리 소수 수량을 허용한다", () => {
    expect(validateUsdtAmount("100.123456")).toBe("100.123456");
  });

  it("부동소수점 오차를 유발할 수 있는 입력을 거부한다", () => {
    expect(() => validateUsdtAmount("1.1234567")).toThrow();
    expect(() => validateUsdtAmount("-1")).toThrow();
    expect(() => validateUsdtAmount("1e3")).toThrow();
  });

  it("만료된 견적을 구분한다", () => {
    const quote = {
      quoteId: "q1", swapId: "s1", usdtAmount: "10", aahPriceKrw: "46743",
      grossAah: "0.2", foundationFeeAah: "0.001", networkFeeAah: "0.0001",
      minimumReceivedAah: "0.1989", expiresAt: "2026-07-27T00:00:00Z"
    };
    expect(quoteIsExpired(quote, Date.parse("2026-07-27T00:00:01Z"))).toBe(true);
  });
});
