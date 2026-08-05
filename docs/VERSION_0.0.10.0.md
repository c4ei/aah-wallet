# IEUM Wallet 0.0.10.0

- Light: 내장 Core 없이 `https://rpc.ieum.aah.name`을 기본 사용합니다.
- Normal: Windows/Ubuntu용 `ieum-chain`을 포함하고 `127.0.0.1:8989`를 사용합니다.
- Android: 백그라운드 실행 제한 때문에 Light만 제공합니다.

두 에디션은 제품명, 앱 식별자, 업데이트 채널이 분리되어 함께 설치할 수 있습니다. Normal은 8989 포트의 기존 Core가 있으면 이를 사용하고, 없으면 사용자 앱 데이터의 `core` 폴더에서 내장 Core를 시작합니다. 월렛이 시작한 Core만 종료 시 함께 정리하며 원장과 키는 업데이트 후에도 보존합니다.

Actions의 `core_ref`에는 Normal에 포함할 검증된 `ieum-chain` 태그나 커밋을 지정합니다. 운영 배포에서는 `main` 대신 고정 태그 또는 커밋을 권장합니다.

기존 0.0.9.3은 에디션 구분이 없으므로 자동 업데이트 시 안전한 Light로 이동합니다. Normal을 원하는 사용자는 0.0.10.0 Normal을 한 번 직접 선택해 설치하며, 그 뒤에는 Normal 채널에서만 자동 업데이트합니다.

 npm run build && npm test && cd src-tauri && cargo fmt --all --check && cargo test --locked && cargo build --release --locked



 cd /home/dev/www/ieum-wallet/src-tauri

cargo fmt --all

cargo fmt --all --check &&
cargo test --locked &&
cargo build --release --locked







npm run tauri dev
