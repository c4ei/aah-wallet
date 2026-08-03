import { webcrypto } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { createRoomSecret, decryptChat, encryptChat, type ChatMessage } from "./communication";

beforeAll(() => {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
  });
});

describe("종단간 암호화 채팅", () => {
  it("올바른 방 키만 메시지를 복호화한다", async () => {
    const secret = createRoomSecret();
    const message: ChatMessage = {
      id: "message-0123456789",
      scope: "direct",
      roomId: "room-1",
      senderAddress: "0x0000000000000000000000000000000000000001",
      senderName: "나",
      text: "안전한 메시지",
      sentAt: new Date().toISOString()
    };
    const encrypted = await encryptChat(message, secret);
    expect(encrypted).not.toContain(message.text);
    await expect(decryptChat(encrypted, secret)).resolves.toEqual(message);
    await expect(decryptChat(encrypted, createRoomSecret())).rejects.toBeDefined();
  });
});
