# v0.0.1.1 작업 기록

## 목표

IEUM Chain을 처음 사용하는 사람이 PC에서 지갑을 만들고, 백업·복원하고,
잔액 확인과 송금을 시험할 수 있는 첫 지갑 MVP입니다.

## 이번 버전에서 한 일

1. Tauri 2 + React + TypeScript 신규 프로젝트
2. BIP-39 12단어 SEED 생성
3. SEED와 Private Key 복원
4. Ethereum 호환 주소와 BIP-44 파생 경로
5. AES-256-GCM 암호화 지갑 파일 저장
6. `eth_chainId`, `eth_getBalance`, `eth_getTransactionCount` 조회
7. EIP-155 legacy 거래의 앱 내부 서명
8. `eth_sendRawTransaction` 전송
9. 내 주소 QR과 RPC 설정
10. Rust/TypeScript 단위 테스트

## 특이점

- 지갑과 체인은 별도 프로젝트이며 버전도 독립적입니다.
- IEUM는 소수점 18자리를 사용합니다. 화면의 `1 IEUM`는 원장의
  `1,000,000,000,000,000,000` 최소 단위입니다.
- 노드는 `aah-chain v0.0.5.2`, Chain ID는 `21004`를 기준으로 했습니다.
- SEED와 Private Key는 노드에 보내지 않습니다. 앱에서 raw transaction을
  서명한 뒤 서명 결과만 노드로 보냅니다.
- 현재 체인이 legacy type-0만 지원하므로 EIP-1559(type-2)는 사용하지 않습니다.
- 거래 수수료는 `gasPrice(1) × gasLimit(21,000)`인 임시값입니다.
- 제네시스 잔액은 `u128`이지만 현재 거래 금액은 `u64`라 1회 송금이 약
  `18.44 IEUM`로 제한됩니다. 앱에서도 이보다 큰 전송을 먼저 거부합니다.
- 앱을 삭제하면 로컬 암호화 지갑 파일도 함께 사라질 수 있습니다. SEED 백업이
  유일한 최종 복구 수단입니다.

## 아직 해야 하는 일

- OS Keychain/Windows Credential Manager를 이용한 비밀번호 보강
- 자동 잠금 시간 선택과 생체 인증
- 카메라 QR 스캔
- 과거 거래 목록을 위한 Explorer 인덱서 연동
- 주소록, 친구, 그룹
- 광고 시청 완료 서버와 4시간 보상
- Android/iOS 실제 기기 빌드·서명·스토어 배포
- 외부 보안 감사와 위협 모델 검토

## 다음 버전

`v0.0.1.2`에서는 사용성·키 보관·거래 상태를 보강하고, 안정화 뒤
`v0.0.2.1`에서 4시간 광고 보상 서버 연동을 시작합니다.
