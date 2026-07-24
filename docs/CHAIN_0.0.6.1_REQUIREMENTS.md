# aah-chain v0.0.6.1 지갑 연동 보강 요구사항

지갑 `v0.0.1.1`~`v0.0.3.1` 구현 과정에서 확인된 체인 보강 항목이다.

## 필수

- 거래 금액과 수수료 계산을 `u64`에서 `u128`로 통일
- `eth_getTransactionCount(..., "pending")` 지원
- mempool의 동일 계정 nonce 예약 및 대체 정책
- `eth_estimateGas`와 `eth_gasPrice` 또는 AAH 전용 수수료 RPC
- 거래 영수증의 `pending / confirmed / failed` 상태 일관성
- RPC 오류 코드와 메시지 표준화
- 동일 raw transaction 재전송의 멱등 처리
- 연속 그룹 송금 시 nonce N, N+1 거래 수용

## 합의·운영

- locked/valid value가 포함된 BFT 안전성 보강
- 체크포인트에 검증자 정족수 서명
- 분할망·재접속 후 동일 높이 충돌 시험
- 4노드 장시간 시험과 RPC 부하 시험
- 보상 지갑의 nonce 직렬화 및 지급 중복 방지

## 지갑과 함께 실행할 시험

- 20 AAH 이상 전송
- 같은 계정에서 10건 연속 전송
- 같은 raw transaction 2회 제출
- 수신 노드와 제출 노드가 다른 경우 영수증 조회
- 블록 확정 전후 잔액과 nonce 조회
- 노드 재시작 중 pending 거래 처리
