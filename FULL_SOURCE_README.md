# IEUM Wallet v0.0.9.0 풀소스

이 압축은 GitHub `c4ei/ieum-wallet`의 v0.0.8.0 기준 추적 파일 전체에 v0.0.9.0 변경 내용을 반영한 풀소스입니다.

누락 문제가 있었던 다음 파일을 포함합니다.

- `scripts/tauri-clean-env.mjs`
- `src/communication.ts`
- `src/video.ts`
- `src/transferHistory.ts`
- 위 모듈의 테스트 파일

설치 및 검사:

```bash
npm ci
npm run build
npm test
cd src-tauri
cargo fmt --all --check
cargo clippy --all-targets --all-features --locked -- -D warnings
cargo test --all-targets --all-features --locked
cd ..
npm run tauri dev
```

권장 Node.js 버전은 22.12 이상입니다. `node_modules`, `dist`, Rust `target`, 개인 지갑 데이터와 키는 포함하지 않았습니다.

검증 결과:

- TypeScript/Vite 빌드 성공
- Vitest 9개 파일, 17개 테스트 통과
- 상대 import 대상 누락 없음
- Tauri CLI 래퍼 실행 확인
- 현재 패키징 환경에는 Rust 도구체인이 없어 Cargo 검사는 실행하지 못함
