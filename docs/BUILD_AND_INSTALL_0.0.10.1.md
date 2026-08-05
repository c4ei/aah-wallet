# IEUM Wallet 0.0.10.1 빌드 및 설치

## 에디션

- Light: Core를 포함하지 않으며 기본 RPC로 `https://irpc.aah.name`을 사용합니다.
- Normal: `ieum-chain` Core를 포함하며 로컬 RPC `http://127.0.0.1:8989`를 사용합니다.
- Android: Light만 빌드합니다.

## 공통 준비

Node.js 22, npm, Rust stable을 설치합니다. Ubuntu에서는 다음 패키지도 필요합니다.

```bash
sudo apt-get update
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev \
  patchelf libfuse2 xdg-utils
```

소스 검증:

```bash
npm ci
DISPLAY_VERSION=0.0.10.4 npm run validate:release
npm run build
npm test
cd src-tauri
cargo fmt --all --check
cargo test --locked
cargo build --release --locked
```

`cargo fmt --all --check`가 포맷 차이로 중단되면 `cargo fmt --all`을 한 번 실행한 뒤 다시 검사합니다.

## Light 빌드

Ubuntu:

```bash
node scripts/prepare-edition.mjs light
npm run tauri -- build \
  --config src-tauri/tauri.light.conf.json \
  --bundles appimage,deb
```

Windows PowerShell:

```powershell
node scripts/prepare-edition.mjs light
npm run tauri -- build --config src-tauri/tauri.light.conf.json --bundles nsis,msi
```

## Normal 빌드

Normal은 먼저 현재 운영 버전의 `ieum-chain`을 release 모드로 빌드한 뒤 `scripts/stage-core-sidecar.mjs`로 배치해야 합니다.

```bash
cargo build --release --locked --manifest-path ../ieum-chain/Cargo.toml
node scripts/stage-core-sidecar.mjs
node scripts/prepare-edition.mjs normal
npm run tauri -- build \
  --config src-tauri/tauri.normal.conf.json \
  --features embedded-core
```

## GitHub Actions 빌드

Repository Settings의 Actions secrets/variables에 다음 값을 등록합니다.

- Secret `TAURI_SIGNING_PRIVATE_KEY`
- Secret `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- Variable `TAURI_UPDATER_PUBLIC_KEY`

Actions에서 `Build and release IEUM Wallet Light and Normal`을 실행하고 다음 값을 입력합니다.

- `version`: `0.0.10.1`
- `core_ref`: Normal에 포함할 `ieum-chain` 태그 또는 커밋

워크플로는 버전 일치, updater 키, 웹 빌드와 테스트를 먼저 검사한 뒤 Windows/Ubuntu Light·Normal 및 Android Light를 빌드합니다.

## 설치

- Windows: NSIS `.exe` 또는 `.msi`를 실행합니다.
- Ubuntu AppImage: `chmod +x 파일명.AppImage` 후 실행합니다.
- Ubuntu DEB: `sudo apt install ./파일명.deb`로 설치합니다.
- Android: ARM64 APK를 기기로 옮겨 설치합니다. 기존 설치본과 서명키가 다르면 먼저 기존 앱을 제거해야 할 수 있으므로 운영 서명키를 계속 유지합니다.

Normal의 원장과 노드 키는 사용자 데이터 폴더에 저장되며 월렛 업데이트 후에도 유지됩니다. Light와 Normal은 설치 식별자가 달라 함께 설치할 수 있습니다.
