# IEUM Wallet v0.0.3.3

`v0.0.3.2`의 사용자 친화 UI를 유지하면서 플랫폼별 웹사이트 열기와
설치·빌드 절차를 보강한 버전입니다.

## 변경 사항

- npm, Tauri, Rust 패키지 버전을 `0.0.3-3`으로 통일
- Windows/Linux/macOS: `aah.name`을 IPC 권한이 없는 별도 WebView 창으로 표시
- Android/iOS: `aah.name`을 시스템 기본 브라우저로 표시
- Windows, Linux, Android, iOS 설치 및 배포 빌드 절차 문서화

## 플랫폼 분기 이유

데스크톱은 여러 창을 안정적으로 지원하므로 사이트 전용 창을 만들 수 있습니다.
모바일은 다중 WebView의 동작과 수명 주기가 기기마다 다를 수 있어 시스템 브라우저를
사용합니다. 두 방식 모두 원격 사이트를 개인키와 서명 기능이 있는 지갑 화면에서
분리합니다.

## 확인 명령

```bash
npm install
npm test
npm run build
cargo fmt --check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

플랫폼별 준비와 빌드 명령은 [`INSTALL.md`](INSTALL.md)를 참고하세요.
