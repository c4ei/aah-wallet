# AAH Wallet v0.0.3.1

https://github.com/c4ei/aah-wallet

`aah-chain` 테스트넷(Chain ID `21004`)용 Tauri 2 지갑입니다.

> 이 버전은 개발·사설 테스트넷용입니다. 실제 가치가 있는 자산을 보관하지 마세요.

## 구현 기능

- BIP-39 12단어 SEED로 신규 지갑 생성
- SEED 또는 secp256k1 Private Key 복원
- Ethereum 호환 주소와 `m/44'/60'/0'/0/0` 파생
- 비밀번호 기반 AES-256-GCM 로컬 암호화 보관
- AAH 잔액 및 nonce 확인
- EIP-155 legacy raw transaction 로컬 서명·전송
- 내 주소 QR 표시
- AAH RPC 주소 및 Chain ID 검증
- 반응형 PC·모바일 화면
- 서버 시각 기준 4시간 광고 보상 화면과 API 계약
- 친구 주소록, 그룹과 초대 코드
- 그룹 구성원별 순차 송금

## 빠른 실행

```bash
npm install
npm run tauri dev
```

먼저 `aah-chain v0.0.5.2` 노드를 `127.0.0.1:8545`에서 실행해야 합니다.
설치와 상세 테스트는 [`docs/TESTING.md`](docs/TESTING.md)를 참고하세요.

## 문서

- [`docs/VERSION_0.0.1.1.md`](docs/VERSION_0.0.1.1.md): 이번 버전 작업·특이점·남은 일
- [`docs/VERSION_0.0.2.1.md`](docs/VERSION_0.0.2.1.md): 4시간 광고 보상과 서버 계약
- [`docs/VERSION_0.0.3.1.md`](docs/VERSION_0.0.3.1.md): 친구·그룹·초대·그룹 송금
- [`docs/CHAIN_0.0.6.1_REQUIREMENTS.md`](docs/CHAIN_0.0.6.1_REQUIREMENTS.md): 체인 보강 요구사항
- [`docs/TESTING.md`](docs/TESTING.md): 초보자용 실행·테스트 절차
- [`docs/SECURITY.md`](docs/SECURITY.md): 키 보관과 보안 한계
- [`docs/ROADMAP.md`](docs/ROADMAP.md): 광고 보상·친구·그룹 개발 순서

## 폴더 구조

```text
src/                 React/TypeScript 화면, 지갑, 암호화, RPC
src-tauri/           Rust 기반 로컬 파일·RPC 프록시
docs/                버전별 작업과 테스트 문서
```

Ubuntu에서 처음 빌드할 때 필요한 GUI 패키지는
[`docs/TESTING.md`](docs/TESTING.md)에 정리되어 있습니다.
