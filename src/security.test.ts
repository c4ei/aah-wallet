import { describe, expect, it } from "vitest";
import { decryptLocalData, encryptLocalData } from "./vault";

describe("로컬 보안 데이터", () => {
  it("주소록 형태의 데이터를 암호화하고 같은 비밀값으로만 복호화한다", async () => {
    const source = {
      version: 2,
      friends: [{ name: "친구", address: "0x0000000000000000000000000000000000000001" }],
      groups: []
    };
    const encrypted = await encryptLocalData(source, "0xwallet-secret");

    expect(encrypted).not.toContain("친구");
    await expect(decryptLocalData(encrypted, "wrong-secret")).rejects.toThrow();
    await expect(decryptLocalData(encrypted, "0xwallet-secret")).resolves.toEqual(source);
  });
});
