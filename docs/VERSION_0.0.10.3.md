# IEUM Wallet 0.0.10.3 변경 내역

## 목적

- Linux/WebView에서 선택 상자의 항목 글자가 배경과 겹쳐 보이지 않는 문제를 수정한다.
- GitHub Actions의 Android Light 빌드가 에디션 식별자 변경 후 남은 Android 생성물 때문에 실패하는 문제를 수정한다.
- Light/Normal 설치 파일 및 `latest.json`이 실제 릴리스에 생성되는 과정을 다시 확인할 수 있게 한다.

## 변경 내용

### 선택 상자

- `select`에 다크 색상 체계를 명시했다.
- `option`의 글자색과 배경색을 명시해 Linux, Tauri WebView 및 브라우저의 기본 테마 차이에도 항목이 보이게 했다.

### GitHub Actions 및 Android

- 표시 버전을 `0.0.10.3`, npm/Cargo/Tauri 내부 버전을 `0.0.10-3`으로 변경했다.
- Android 빌드 전에 `src-tauri/gen/android`를 제거하고 Light 설정으로 다시 생성한다.
- `android init`과 `android build` 양쪽 모두 `tauri.light.conf.json`을 사용한다.
- 이에 따라 `net.aah.wallet.light` 패키지 경로와 생성된 Android 프로젝트의 Java/Kotlin 경로가 항상 일치한다.
- Android 실패는 데스크톱 Light/Normal 빌드와 병렬로 처리되므로 데스크톱 릴리스 생성을 막지 않는다.

### Windows Normal 내장 코어

- Windows runner에서 `ieum-chain` 링크가 `sqlite3.lib`를 찾지 못해 발생한 `LNK1181` 오류를 수정했다.
- Windows Normal 작업에 vcpkg의 `sqlite3:x64-windows-static-md`를 설치하고 Rust 링커가 해당 라이브러리 경로를 사용하도록 설정했다.
- 정적 SQLite를 사용하므로 설치 후 별도의 `sqlite3.dll`을 찾지 못해 코어가 시작되지 않는 문제도 피한다.
- Ubuntu Normal에는 `libsqlite3-dev` 설치를 명시했다.

## 업데이트 확인 실패에 대한 설명

월렛의 자동 업데이트 확인은 빌드 자체가 아니라 GitHub Release에 유효한 `latest.json`과 서명된 설치 파일이 게시돼 있어야 성공한다. 이전 Actions가 끝까지 릴리스를 만들지 못했기 때문에 `Could not fetch a valid release JSON`이 발생한 것이다. 0.0.10.3을 푸시한 뒤 Actions에서 데스크톱 Light/Normal 작업과 릴리스 작업이 성공했는지 확인해야 한다.

## Android 운영 배포 전 추가 작업

현재 Actions의 Android 결과물은 설치 테스트용 debug APK다. Google Play 운영 배포 전에는 다음 작업이 필요하다.

1. Android 전용 업로드 키와 keystore를 생성하고 안전하게 백업한다.
2. keystore, alias, 비밀번호를 GitHub Actions Secrets로 등록한다.
3. Actions의 `android_release`를 켜면 별도 `android-release` 작업이 release AAB를 서명해 생성한다.
4. `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`를 GitHub Actions Secrets로 등록한다.
5. Google Play App Signing을 사용하고 생성된 AAB를 내부 테스트 트랙에 먼저 올려 검증한다.
6. Android는 데스크톱용 Tauri `latest.json` 자동 설치 대신 Play Store의 버전 코드와 단계적 출시로 업데이트한다.
7. 최초 운영 서명 후에는 같은 애플리케이션 ID와 서명키를 계속 유지한다.

서명키는 소스 또는 변경 압축에 포함하지 않는다. 키가 준비되기 전에는 `android_release`를 끄고 debug APK만 생성한다. 스토어 자동 업로드는 Google Play 서비스 계정과 앱 등록이 준비된 뒤 추가하며, 현재는 서명된 AAB를 내부 테스트 트랙에 수동 업로드하는 방식이다.

## 최종 확인 항목

- `validate`, Windows/Ubuntu Light, Windows/Ubuntu Normal, `android-light`가 성공하는지 확인한다. 특히 Windows Normal 로그에서 `sqlite3.lib` 링크가 통과하는지 확인한다.
- `wallet-light-latest`, `wallet-normal-latest` Release에 각 설치 파일과 서명 파일이 있는지 확인한다.
- 각 Release의 `latest.json`이 실제 다운로드 URL과 서명을 포함하는지 확인한다.
- 설치된 0.0.10.3 Light와 Normal에서 각각 다음 버전 확인을 시험한다.
