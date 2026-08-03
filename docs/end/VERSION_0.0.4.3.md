# IEUM Wallet v0.0.4.3 변경 내용

기준 소스: `ieum_wallet_v0_0_4_2_test`

## 변경 내용

- 앱·Tauri 패키지 버전을 `0.0.4-3`으로 통일
- IEUM Chain JSON-RPC 연결 화면과 상태 표시 보완
- HTTP 오류, 빈 응답, HTML 응답, JSON-RPC 오류를 구분해 표시
- Tauri HTTP 호출 명령과 권한 설정 반영
- RPC 기본 주소를 `http://127.0.0.1:8545`로 사용

## 확인

```bash
npm ci
npm test
npm run build
```

체인은 별도 터미널에서 다음처럼 실행되어 있어야 합니다.

```bash
cargo run -- --port 7001 --rpc-port 8989
```

USDT 간편교환은 월렛 RPC와 별개이며 `cex.aah.name`의
`/api/v1/simple-swap/*` 서버 API가 배포되어야 실제로 동작합니다.
