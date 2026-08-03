# IEUM Wallet v0.0.7.0 Snap 실행 환경 보정

## 수정 내용

- Snap으로 설치된 VS Code나 터미널에서 상속된 `LD_LIBRARY_PATH` 때문에 Tauri 실행
  파일이 `/snap/core20`의 `libpthread.so.0`을 잘못 읽는 문제를 수정했습니다.
- `npm run tauri dev` 실행 시 Linux의 Snap 라이브러리 경로만 제거한 뒤 Tauri CLI를
  실행합니다.
- Windows와 macOS에서는 기존 환경을 그대로 사용합니다.

## 원인

`libpthread.so.0`과 `libc.so.6`은 같은 GLIBC 배포본의 파일을 함께 사용해야 합니다.
호스트 Ubuntu의 실행 파일이 Snap `core20`의 `libpthread.so.0`을 먼저 읽으면
`__libc_pthread_init@GLIBC_PRIVATE` 심볼 버전이 맞지 않아 앱 시작 전에 종료됩니다.
애플리케이션의 Rust 로직이나 WebRTC 기능에서 발생한 오류는 아닙니다.

## 확인

프로젝트 루트에서 실행합니다.

```bash
npm install
npm run tauri dev
```

현재 셸의 오염 여부는 다음 명령으로 확인할 수 있습니다.

```bash
printf '%s\n' "$LD_LIBRARY_PATH"
```

출력에 `/snap/core20/current/lib/x86_64-linux-gnu`가 있어도 새 실행 래퍼가 Tauri
프로세스에 전달하기 전에 해당 경로를 제거합니다.
