import { webcrypto } from "node:crypto";

// 브라우저에서는 Web Crypto가 전역으로 제공되지만 일부 Node 테스트 환경에서는
// 제공되지 않으므로 Vitest 실행 중에만 Node의 호환 구현을 연결합니다.
if (!globalThis.crypto) {
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: webcrypto
  });
}
