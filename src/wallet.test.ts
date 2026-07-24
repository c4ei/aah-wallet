import { describe, expect, it } from "vitest";
import { restoreFromMnemonic, restoreFromPrivateKey, validateTransfer } from "./wallet";

describe("AAH 지갑", () => {
  it("표준 SEED를 같은 주소로 복원한다", () => {
    const wallet = restoreFromMnemonic("test test test test test test test test test test test junk");
    expect(wallet.address.toLowerCase()).toBe("0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266");
  });

  it("개인키 1의 Ethereum 호환 주소를 만든다", () => {
    const wallet = restoreFromPrivateKey("0".repeat(63) + "1");
    expect(wallet.address.toLowerCase()).toBe("0x7e5f4552091a69125d5dfcb7b8c2659029395bdf");
  });

  it("잘못된 주소와 0 이하 송금을 거부한다", () => {
    expect(() => validateTransfer("wrong", "1")).toThrow();
    expect(() => validateTransfer("0x0000000000000000000000000000000000000001", "0")).toThrow();
    expect(validateTransfer("0x0000000000000000000000000000000000000001", "20"))
      .toBe(20_000_000_000_000_000_000n);
  });
});
