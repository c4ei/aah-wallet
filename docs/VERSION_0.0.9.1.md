# IEUM Wallet v0.0.9.1 멀티 플랫폼 빌드

## 요청

- GitHub의 `c4ei/ieum-wallet` 최신 `main`을 기준으로 작업
- Windows, Ubuntu, Android 실행 파일을 한 번에 빌드
- 배포 버전 `0.0.9.1`

## 처리 내용

- `.github/workflows/wallet-build.yml` 추가
- Windows x86_64: NSIS `.exe`, MSI `.msi`
- Ubuntu x86_64: `.AppImage`, `.deb`
- Android ARM64: 설치 시험용 디버그 `.apk`
- `Makefile`에서 GitHub Actions 수동 워크플로 실행 지원
- 프런트 빌드와 테스트를 먼저 통과해야 OS별 빌드가 실행되도록 구성

## 버전 표기

npm, Cargo, Tauri는 숫자 네 칸의 `0.0.9.1`을 유효한 SemVer로 인정하지 않는다.
따라서 내부 버전은 `0.0.9-1`, 배포명과 문서 및 Artifact 이름은 `0.0.9.1`을 사용한다.

## 실행 방법

GitHub 저장소의 Actions 화면에서 `Build IEUM Wallet`을 선택하고 `Run workflow`를 누른다.
버전 입력값은 `0.0.9.1`을 사용한다.

GitHub CLI가 설치되고 로그인된 PC에서는 다음 명령도 사용할 수 있다.

```bash
make wallet-all VERSION=0.0.9.1
```

완료 후 해당 Actions 실행의 Artifacts에서 운영체제별 파일을 내려받는다.

## 서명 관련

이번 시험 빌드는 코드 서명 인증서와 Android 배포용 keystore를 사용하지 않는다.
기능 확인 후 Windows 인증서와 Android keystore를 GitHub Actions Secrets에 등록해 정식 서명 빌드로 전환한다.
