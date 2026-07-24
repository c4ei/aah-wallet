# 설치와 테스트 방법

## 1. 준비물

- Node.js 20 이상
- Rust stable
- Tauri가 요구하는 OS별 개발 도구
- `aah-chain v0.0.5.2`

Ubuntu:

```bash
sudo apt update
sudo apt install -y build-essential curl wget file libssl-dev \
  libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev libwebkit2gtk-4.1-dev
```

Windows에서는 Microsoft C++ Build Tools와 WebView2가 필요합니다.

## 2. AAH 노드 실행

`aah-chain` 폴더에서:

```bash
cargo run --release -- \
  --rpc-addr 127.0.0.1 \
  --rpc-port 8545 \
  --genesis config/genesis.json
```

Chain ID 확인:

```bash
curl -s http://127.0.0.1:8545 \
  -H "content-type: application/json" \
  --data '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}'
```

`21004`의 hex인 `0x520c`가 응답에 있어야 합니다.

## 3. 지갑 개발 실행

```bash
npm install
npm run test
npm run build
npm run tauri dev
```

Rust 검사:

```bash
cd src-tauri
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test
```

## 4. 수동 기능 테스트

### 신규 생성

1. `새 지갑 만들기` 선택
2. 12단어를 종이에 적기
3. 백업 확인 체크
4. 8자 이상 비밀번호로 저장
5. 주소가 `0x`와 40자리 hex로 표시되는지 확인

### 복원

1. 앱 잠금 또는 테스트용 앱 데이터 제거
2. `지갑 복원` 선택
3. 앞에서 적은 12단어 입력
4. 같은 주소가 나오는지 확인
5. 별도로 Private Key 복원도 같은 주소인지 확인

### 잔액

1. 노드 실행 확인
2. RPC를 `http://127.0.0.1:8545`로 입력
3. `연결 테스트` 또는 `새로고침`
4. Chain ID가 다르면 앱이 거부하는지 확인

### 전송

1. 제네시스에서 개인키를 보유한 테스트 계정을 복원
2. 받는 주소와 소량의 AAH 입력
3. 전송 후 거래 해시 표시 확인
4. 받는 지갑에서 새로고침하여 잔액 확인
5. 노드의 `eth_getTransactionReceipt`로 거래 해시 확인

현재 체인의 거래 금액 필드가 `u64`라 한 번에 약 `18.44 AAH`를 넘길 수 없습니다.
그보다 큰 금액은 여러 번 나누거나, 차후 체인의 거래 필드를 `u128`로 확장해야 합니다.

## 5. 모바일 화면 확인

웹 반응형 화면만 확인할 때:

```bash
npm run dev -- --host 0.0.0.0
```

PC 브라우저 개발자 도구에서 360px 폭을 선택합니다. 실제 Android/iOS 앱 테스트는
Tauri 모바일 개발 환경과 SDK 설정이 필요하며 이번 전달본에서는 빌드 검증 대상이
아닙니다.

## 실패할 때

- 노드 연결 실패: 노드 실행, 포트 `8545`, 방화벽 확인
- Chain ID 오류: 노드 genesis가 `21004`인지 확인
- 잔액 0: 복원 주소가 genesis의 주소와 같은지 확인
- nonce 오류: 같은 계정의 동시 전송을 멈추고 새로고침
- raw transaction 오류: 체인 버전이 legacy EIP-155를 지원하는지 확인
