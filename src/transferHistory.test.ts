import { describe, expect, it } from "vitest";
import { pageCount, transferPage } from "./transferHistory";

describe("최근 전송 페이징", () => {
  it("5건 단위로 마지막 페이지까지 나눈다", () => {
    const items = Array.from({ length: 12 }, (_, index) => index + 1);
    expect(pageCount(items.length)).toBe(3);
    expect(transferPage(items, 2)).toEqual([6, 7, 8, 9, 10]);
    expect(transferPage(items, 99)).toEqual([11, 12]);
  });
});
