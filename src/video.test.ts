import { describe, expect, it } from "vitest";
import { mediaConstraints, parseIceServers } from "./video";

describe("WebRTC 설정", () => {
  it("STUN/TURN만 허용하고 TURN 인증을 요구한다", () => {
    expect(parseIceServers('[{"urls":"stun:stun.example.com:3478"}]')).toHaveLength(1);
    expect(() => parseIceServers('[{"urls":"https://example.com"}]')).toThrow();
    expect(() => parseIceServers('[{"urls":"turn:turn.example.com:3478"}]')).toThrow();
  });

  it("영상 비활성화 시에도 보안 음성 제약을 유지한다", () => {
    const constraints = mediaConstraints(false);
    expect(constraints.video).toBe(false);
    expect(constraints.audio).toMatchObject({ echoCancellation: true, noiseSuppression: true });
  });
});
