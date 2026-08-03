# IEUM Wallet v0.0.9.0 · IEUM Chain v0.21.0 연동

## 요청 사항

- 신규 노드의 운영망 합류 상태를 월렛에서 확인한다.
- 잘못된 체인, 동기화 중인 노드, 복구 처리 중인 노드로 송금하지 않는다.

## 처리 내용

- Chain ID 21004와 운영 제네시스 해시를 함께 검증한다.
- 프로토콜 최소 호환 버전, 피어, 동기화율과 최종 확정 블록을 표시한다.
- 동기화 완료 전 또는 복구안 처리 중에는 송금을 차단한다.
- Tauri 허용 목록에 v0.21.0 읽기 전용 운영 RPC를 추가했다.

## 배포 전 검사

```bash
npm ci
npm run build
npm test
cd src-tauri
cargo fmt --all --check
cargo test --locked
cargo build --release --locked
```
