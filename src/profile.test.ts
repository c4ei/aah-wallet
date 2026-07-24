import { describe, expect, it } from "vitest";
import { normalizeProfile } from "./profile";

describe("사용자 프로필", () => {
  it("닉네임과 선택 이메일을 정리한다", () => {
    expect(normalizeProfile({
      nickname: "  아하사용자 ",
      email: " USER@Example.COM ",
      onboardingDone: true
    })).toEqual({
      nickname: "아하사용자",
      email: "user@example.com",
      onboardingDone: true
    });
  });

  it("이메일을 입력했다면 형식을 검사한다", () => {
    expect(() => normalizeProfile({
      nickname: "사용자",
      email: "잘못된메일",
      onboardingDone: false
    })).toThrow("이메일 형식");
  });
});
