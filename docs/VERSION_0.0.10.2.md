# IEUM Wallet 0.0.10.2 변경 내역

## 작업 목적

- GitHub Actions의 검증 및 빌드가 중간에 중단되는 문제를 수정한다.
- 아직 운영 준비가 끝나지 않은 USDT 교환과 광고 보상을 화면에서 숨긴다.
- 기능 소스와 테스트는 보존해 이후 다시 활성화할 수 있게 한다.

## 변경 내용

### 1. GitHub Actions 수정

- 표시 버전 `0.0.10.2`와 npm/Cargo/Tauri 내부 버전 `0.0.10-2`를 자동 비교한다.
- 첨부된 실패 로그에서 버전 검증 이후 `TAURI_UPDATER_PUBLIC_KEY`가 비어
  `test -n ""` 단계가 종료 코드 1을 반환하던 문제를 수정했다.
- `TAURI_UPDATER_PUBLIC_KEY` 저장소 변수가 없으면 저장소의
  `src-tauri/updater-public.key`를 사용하도록 변경했다.
- 업데이트 개인 서명키 `TAURI_SIGNING_PRIVATE_KEY`는 보안상 계속 필수다.
- Light와 Normal 데스크톱 빌드, Android Light 빌드 구조는 유지한다.

공개키는 업데이트 서명 검증용이므로 저장소에 포함해도 된다. 개인키는 절대로
저장소에 추가하지 않는다.

### 2. 준비 중 기능 UI 숨김

- 상단 메뉴에서 `USDT 교환`을 숨겼다.
- 상단 메뉴에서 `광고 보상`을 숨겼다.
- 해당 화면 렌더링도 기본적으로 비활성화했다.
- API 호출 코드, 기능 코드, 스타일 및 테스트는 삭제하지 않았다.

추후 다음 빌드 환경변수로 각각 다시 표시할 수 있다.

```env
VITE_SHOW_USDT_EXCHANGE=true
VITE_SHOW_AD_REWARDS=true
```

환경변수를 설정하지 않으면 두 기능은 표시되지 않는다.

## 버전

| 구분 | 값 |
| --- | --- |
| 사용자 표시 버전 | `0.0.10.2` |
| npm/Cargo/Tauri 버전 | `0.0.10-2` |
| Light 기본 RPC | `https://irpc.aah.name` |

## 검증 명령

```bash
DISPLAY_VERSION=0.0.10.2 npm run validate:release
npm ci
npm run build
npm test
cd src-tauri
cargo fmt --all --check
cargo test --locked
cargo build --release --locked
```

## 차후 작업

- USDT 교환 서버의 입금 확인, 준비금 관리, 장애 복구 절차를 운영 검증한 뒤 UI를 활성화한다.
- 광고 보상의 부정 수급 방지, 지급 한도, 서버 시각 검증을 완료한 뒤 UI를 활성화한다.
- GitHub Actions에서 Light/Normal 설치 파일과 `latest.json` 생성 여부를 실제 릴리스로 최종 확인한다.
- Android 운영 배포 전 릴리스 서명 및 스토어 업데이트 방식을 추가한다.
