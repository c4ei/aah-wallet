import { describe, expect, it } from "vitest";
import {
  CHAIN_ID,
  EXPECTED_GENESIS_HASH,
  restoreFromMnemonic,
  restoreFromPrivateKey,
  validateTransfer
} from "./wallet";

describe("IEUM 지갑", () => {
  it("v0.21.4 운영망 식별자를 고정한다", () => {
    expect(CHAIN_ID).toBe(21004);
    expect(EXPECTED_GENESIS_HASH).toBe(
      "0x657ce0cfeb8ad38d88a23711ec2664e5e1033aa8ffd5bb648a02ca0f348a9e1a"
    );
  });

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
