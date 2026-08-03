# IEUM Wallet v0.0.4.1

## 목표

사용자는 지갑에서 다음 세 단계만 수행합니다.

1. USDT 입금
2. IEUM로 교환
3. 현재 IEUM 지갑으로 받기

외부 체인 개인키, 입금 감시, 교환 체결, 준비금 관리와 출금 서명은
`cex.aah.name` 서버가 담당합니다. IEUM Wallet에는 CEX 출금키를 넣지 않습니다.

## 지원 네트워크

| 코드 | USDT 규격 | 용도 |
| --- | --- | --- |
| `TRON` | TRC20 | 기본 선택, 높은 호환성 |
| `SOLANA` | SPL | 저비용 선택 |
| `BSC` | BEP20 | EVM 호환 및 거래소 지원 |

서버는 운영 준비가 끝난 네트워크만 실제로 활성화해야 합니다. 주소 형식만으로
네트워크를 추측하지 않으며, 잘못된 네트워크 입금은 자동 반영하지 않습니다.

## CEX API 계약

```http
POST /api/v1/simple-swap/deposit-address
GET  /api/v1/simple-swap/status/{swapId}
POST /api/v1/simple-swap/quote
POST /api/v1/simple-swap/execute
POST /api/v1/simple-swap/withdraw-aah
```

입금주소 발급:

```json
{
  "asset": "USDT",
  "network": "TRON",
  "destinationAahAddress": "0x..."
}
```

견적 응답:

```json
{
  "quoteId": "q_001",
  "swapId": "s_001",
  "usdtAmount": "100.000000",
  "aahPriceKrw": "46743.28321196",
  "grossAah": "2.117000",
  "foundationFeeAah": "0.010585",
  "networkFeeAah": "0.000100",
  "minimumReceivedAah": "2.106315",
  "expiresAt": "2026-07-27T09:01:00+09:00"
}
```

서버는 문자열 고정소수점으로 계산하고 IEUM 가격의 최신성, 입금 확정 횟수,
견적 만료, 1회성 `quoteId`, 중복 `txHash/logIndex`를 검증해야 합니다.

## 재단 소유와 수수료 회계

사용자가 입금한 USDT 전액이 곧바로 재단 수익이 되는 것은 아닙니다. 교환이
완료될 때까지는 고객 자산 또는 지급 준비금 성격이고, 교환 후에도 IEUM 환매나
출금 의무에 대응할 준비금 정책이 필요합니다.

권장 분리:

- 고객 입금 주소/핫월렛: 입출금 처리용
- 콜드 준비금: 대부분의 USDT 보관
- 재단 수익 지갑: 견적에 공개한 `foundationFeeAah` 상당액만 정산
- 네트워크 비용 계정: 실제 외부 체인 및 IEUM 출금 비용

거래마다 총 입금액, 교환 원금, 재단 수수료, 네트워크 비용, 지급 IEUM와 온체인
거래 해시를 불변 감사 로그로 남깁니다. 수수료율과 수익 귀속은 이용약관과
관련 관할 법규 검토 후 운영 서버에서 확정해야 합니다.

## 서버 구현 전 동작

이 버전은 UI와 API 계약을 구현합니다. CEX에 위 API가 아직 배포되지 않았다면
입금주소 발급 단계에서 오류를 표시하고 이후 교환·출금은 진행하지 않습니다.
실제 가치가 있는 자산을 API 완성 및 보안 점검 전에 입금하면 안 됩니다.
