# AAH Wallet 설치 및 빌드

## 공통 준비

소스를 내려받은 뒤 프로젝트 폴더에서 의존성을 설치합니다.

```bash
git clone https://github.com/c4ei/aah-wallet.git
cd aah-wallet
npm install
```

개발 중 같은 PC에서 노드를 실행하면 기본 RPC `http://127.0.0.1:8545`를 사용할 수
있습니다. 휴대폰에서 테스트할 때 `localhost`는 휴대폰 자신을 뜻하므로 노드 PC의
내부 IP 또는 HTTPS RPC 주소를 사용해야 합니다.

## Windows 10/11

필요한 프로그램:

- Node.js LTS
- Rust stable(MSVC)
- Visual Studio 2022 Build Tools의 `Desktop development with C++`
- Windows 10/11 SDK
- Microsoft Edge WebView2 Runtime

PowerShell에서 확인합니다.

```powershell
node --version
npm --version
rustc --version
cargo --version
```

개발 실행과 설치 파일 빌드:

```powershell
npm run tauri dev
npm run tauri build
```

결과물은 `src-tauri\target\release\bundle\msi\`와
`src-tauri\target\release\bundle\nsis\` 아래에 생성됩니다. 일반 사용자에게
배포할 때는 코드 서명 인증서로 MSI/EXE를 서명하는 것을 권장합니다.

## Ubuntu/Linux

Ubuntu에서 WebKitGTK 등 Tauri 빌드 의존성을 설치합니다.

```bash
sudo apt update
sudo apt install -y \
  build-essential curl file libssl-dev libwebkit2gtk-4.1-dev \
  libappindicator3-dev librsvg2-dev patchelf
```

Rust가 없다면 설치한 뒤 새 셸을 엽니다.

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

개발 실행과 배포 패키지 빌드:

```bash
npm run tauri dev
npm run tauri build
```

결과물은 `src-tauri/target/release/bundle/` 아래에 생성됩니다. VMware에서 3D
관련 EGL 경고가 반복되지만 앱이 실행된다면 기능 오류는 아닙니다. 필요하면 다음처럼
소프트웨어 렌더링을 사용합니다.

```bash
LIBGL_ALWAYS_SOFTWARE=1 npm run tauri dev
```

## Android

Linux, Windows 또는 macOS에서 빌드할 수 있습니다. Android Studio의 SDK Manager에서
SDK Platform, Build-Tools, Platform-Tools, Command-line Tools, NDK, CMake를
설치하고 Java 17을 준비합니다.

Linux 환경변수 예시:

```bash
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export ANDROID_HOME="$HOME/Android/Sdk"
export NDK_HOME="$ANDROID_HOME/ndk/설치된_NDK_버전"
export PATH="$PATH:$ANDROID_HOME/platform-tools"
export PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin"
```

최초 한 번 모바일 프로젝트를 생성합니다.

```bash
npm run tauri android init
```

USB 디버깅을 켠 기기 또는 실행 중인 에뮬레이터에서 확인합니다.

```bash
adb devices
npm run tauri android dev
```

APK/AAB 빌드:

```bash
npm run tauri android build
```

결과물은 `src-tauri/gen/android/app/build/outputs/apk/`와
`src-tauri/gen/android/app/build/outputs/bundle/` 아래에 생성됩니다. Google Play
배포용 서명 키와 비밀번호는 저장소에 커밋하지 마세요.

## iPhone/iOS

iOS 최종 빌드와 서명에는 macOS, Xcode, Apple ID가 필요합니다. 실제 기기 설치와
App Store 배포에는 Apple Developer 계정이 필요합니다.

```bash
xcode-select --install
npm run tauri ios init
npm run tauri ios dev
npm run tauri ios build
```

서명 설정이 필요하면 생성된 Xcode 프로젝트를 엽니다.

```bash
open src-tauri/gen/apple/aah-wallet.xcodeproj
```

Xcode의 `Signing & Capabilities`에서 Team, Bundle Identifier
`net.aah.wallet`, 인증서와 프로비저닝 프로파일을 지정합니다. App Store 제출은
`Product → Archive → Distribute App` 순서로 진행합니다.

## 플랫폼별 `aah.name` 동작

| 플랫폼 | 열기 방식 | 보안 경계 |
|---|---|---|
| Windows/Linux/macOS | 별도 WebView 창 | 사이트 창에 지갑 IPC 권한을 부여하지 않음 |
| Android/iOS | 시스템 기본 브라우저 | 지갑 프로세스의 WebView와 완전히 분리 |

## 배포 전 공통 확인

```bash
npm test
npm run build
cargo fmt --check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

공개 배포에서는 HTTP 내부 주소 대신 `https://rpc.aah.name` 같은 HTTPS RPC를
사용하고, 설치 파일 서명과 앱스토어 서명을 완료해야 합니다.
