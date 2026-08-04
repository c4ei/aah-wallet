# IEUM Wallet 0.0.9.3

## 요청

- 0.0.9.3부터 새 월렛 버전을 자동 감지한다.
- 전체 프로젝트가 아니라 현재 운영체제와 CPU에 맞는 업데이트 설치 파일만 내려받는다.

## 반영

- Tauri v2 updater 플러그인을 데스크톱(Windows, Ubuntu, macOS)에 추가했다.
- 실행 시 GitHub Releases의 `latest.json`을 확인한다.
- 새 버전이면 서명과 SHA 무결성을 검증한 운영체제별 번들만 내려받아 설치하고 재시작한다.
- GitHub Actions가 Windows NSIS/MSI와 Ubuntu AppImage/DEB를 서명하고 Release 및 `latest.json`을 게시한다.
- Android APK는 운영체제 설치 정책 때문에 앱 내부 자동 교체 대상에서 제외하고 기존 Actions 다운로드 방식으로 유지한다.

## 최초 배포 주의

0.0.9.2에는 updater 코드가 없으므로 0.0.9.3은 한 번 직접 설치해야 한다. 그 뒤 0.0.9.4부터 자동 감지·설치된다.

## GitHub 설정

한 번만 Tauri 서명키를 생성하고 다음 값을 저장한다.

- Actions secret: `TAURI_SIGNING_PRIVATE_KEY`
- Actions secret: `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (암호를 사용하지 않으면 빈 값)
- Actions variable: `TAURI_UPDATER_PUBLIC_KEY`

개인키는 저장소, 배포 압축파일, 채팅에 포함하지 않는다. 키를 잃으면 기존 설치본에 새 업데이트를 배포할 수 없으므로 별도 백업이 필요하다.

업데이트 플러그인이 새 Rust 의존성을 추가하므로 최초 적용 후 개발 PC에서 `cargo generate-lockfile`을 한 번 실행해 갱신된 `src-tauri/Cargo.lock`도 커밋한다. Actions도 빌드 직전에 동일 작업을 수행한다.
