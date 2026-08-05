# IEUM Wallet 0.0.10.0 변경 파일

이 압축은 0.0.9.3 소스 위에 덮어쓰는 변경분입니다.

- `.github/workflows/wallet-build.yml`: Light/Normal/Android Light 분리 빌드
- `.gitignore`: 에디션별 임시 환경 파일 제외
- `CHANGELOG.md`, `Makefile`, `package.json`, `package-lock.json`: 0.0.10.0 버전 및 릴리스 입력
- `scripts/prepare-edition.mjs`: 에디션별 RPC와 화면 표시 설정
- `scripts/stage-core-sidecar.mjs`: OS/CPU target 이름으로 Core 배치
- `src-tauri/Cargo.toml`: Normal 전용 embedded-core 기능
- `src-tauri/src/lib.rs`: 내장 Core 시작, 기존 Core 재사용, 종료 처리
- `src-tauri/tauri.conf.json`: 공통 0.0.10.0 설정
- `src-tauri/tauri.light.conf.json`, `src-tauri/tauri.normal.conf.json`: 제품·식별자·업데이트 채널 분리
- `src/App.tsx`, `src/vite-env.d.ts`: 에디션별 기본 RPC 및 화면 표시
- `docs/VERSION_0.0.10.0.md`: 동작 및 배포 문서

기존 0.0.9.3 자동 업데이트 사용자는 Light로 안전하게 이어지고, Normal은 사용자가 한 번 직접 선택합니다.

`src-tauri/Cargo.lock`은 생성 환경의 Rust 의존성 해석 결과를 사용하도록 포함하지 않습니다. 적용 후 `cd src-tauri && cargo generate-lockfile`을 한 번 실행합니다.
