# IEUM Wallet v0.0.7.0

https://github.com/c4ei/ieum-wallet

`ieum-chain` 테스트넷(Chain ID `21004`)용 Tauri 2 지갑입니다.

> 이 버전은 개발·사설 테스트넷용입니다. 실제 가치가 있는 자산을 보관하지 마세요.

## 구현 기능

- BIP-39 12단어 SEED로 신규 지갑 생성
- SEED 또는 secp256k1 Private Key 복원
- Ethereum 호환 주소와 `m/44'/60'/0'/0/0` 파생
- 비밀번호 기반 AES-256-GCM 로컬 암호화 보관
- IEUM 잔액 및 nonce 확인
- EIP-155 legacy raw transaction 로컬 서명·전송
- 내 주소 QR 표시
- IEUM RPC 주소 및 Chain ID 검증
- 반응형 PC·모바일 화면
- 서버 시각 기준 4시간 광고 보상 화면과 API 계약
- 친구 주소록, 그룹과 초대 코드
- 그룹 구성원별 순차 송금
- 처음 사용 안내·닉네임·선택 이메일 프로필
- 송금 최종 확인과 내 주소 복사
- PC에서는 IPC 권한이 분리된 `aah.name` 전용 웹 창
- Android/iOS에서는 `aah.name`을 시스템 기본 브라우저로 열어 지갑과 분리
- TRON·Solana·BSC USDT 입금주소 발급
- USDT 입금 확인 → IEUM 견적·교환 → 현재 IEUM 지갑 출금의 3단계 간편 교환
- 재단 서비스 수수료·출금 비용·최소 수령액을 분리한 견적 표시
- 허용된 `cex.aah.name` 간편교환 API만 호출하는 Tauri 프록시
- `ieum-chain v0.21.0` 기반 peer 간 1:1 종단간 암호화 채팅과 운영 상태 검증
- 방장 1명, 부방장 여러 명, 청중 여러 명으로 구성되는 1:n 채팅방
- AES-256-GCM 메시지 암호화와 90초 전달 유효시간
- 채팅 내용의 블록·원장·서버 DB 미저장
- WebRTC 1:1 음성·영상 통화와 DTLS-SRTP 미디어 보호
- 카메라·마이크 사용 전 운영체제 권한 요청
- 운영 STUN/TURN JSON 설정과 TURN 단기 자격증명 지원
- 통화 내용과 분리된 로컬 JSONL 감사 메타데이터
- 5·15·30분 미사용 자동 잠금과 백그라운드 전환 즉시 잠금
- 지갑 키 기반 AES-256-GCM 친구·그룹 주소록 암호화
- 최근 200건 통화 감사 기록의 기기 내 조회·삭제

## 빠른 실행

```bash
npm install
npm run tauri dev
```

채팅과 송금을 사용하려면 `ieum-chain v0.21.0` 노드를 P2P와 localhost JSON-RPC 포트로 실행해야 합니다.

```bash
cargo run -- --port 7001 --rpc-port 8545
```

친구 등록 시 지갑 주소와 해당 노드 로그에 표시되는 `12D3KooW...` PeerId를 함께
입력합니다. 채팅방 보안 키는 지갑 채팅 화면에서 생성하고, 상대방과 직접 만나거나
이미 확인된 별도 경로로 전달해야 합니다. 보안 키를 같은 채팅방 안에서 보내면 안 됩니다.
설치와 상세 테스트는 [`docs/TESTING.md`](docs/TESTING.md)를 참고하세요.

## 문서

- [`docs/VERSION_0.0.1.1.md`](docs/VERSION_0.0.1.1.md): 이번 버전 작업·특이점·남은 일
- [`docs/VERSION_0.0.2.1.md`](docs/VERSION_0.0.2.1.md): 4시간 광고 보상과 서버 계약
- [`docs/VERSION_0.0.3.1.md`](docs/VERSION_0.0.3.1.md): 친구·그룹·초대·그룹 송금
- [`docs/VERSION_0.0.3.2.md`](docs/VERSION_0.0.3.2.md): 사용자 친화 UI와 IEUM 사이트 창
- [`docs/VERSION_0.0.3.3.md`](docs/VERSION_0.0.3.3.md): 플랫폼 분기와 설치·빌드 안내
- [`docs/VERSION_0.0.4.1.md`](docs/VERSION_0.0.4.1.md): USDT 간편교환과 재단 수익·준비금 정책
- [`docs/INSTALL.md`](docs/INSTALL.md): Windows·Linux·Android·iOS 설치와 빌드
- [`docs/CHAIN_0.0.6.1_REQUIREMENTS.md`](docs/CHAIN_0.0.6.1_REQUIREMENTS.md): 체인 보강 요구사항
- [`docs/TESTING.md`](docs/TESTING.md): 초보자용 실행·테스트 절차
- [`docs/SECURITY.md`](docs/SECURITY.md): 키 보관과 보안 한계
- [`docs/ROADMAP.md`](docs/ROADMAP.md): 광고 보상·친구·그룹 개발 순서
- [`docs/VERSION_0.0.5.0.md`](docs/VERSION_0.0.5.0.md): 1:1·1:n 암호화 채팅과 보안 한계
- [`docs/VERSION_0.0.6.0.md`](docs/VERSION_0.0.6.0.md): WebRTC 화상통화, STUN/TURN 운영, 별도 감사
- [`docs/VERSION_0.0.7.0.md`](docs/VERSION_0.0.7.0.md): 자동 잠금, 주소록 암호화, 감사 기록 관리

## 폴더 구조

```text
src/                 React/TypeScript 화면, 지갑, 암호화, RPC
src-tauri/           Rust 기반 로컬 파일·RPC 프록시
docs/                버전별 작업과 테스트 문서
```

Ubuntu에서 처음 빌드할 때 필요한 GUI 패키지는
[`docs/TESTING.md`](docs/TESTING.md)에 정리되어 있습니다.
