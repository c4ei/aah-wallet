# IEUM Wallet 0.0.10.5 변경 내역

## 적용 내용

- 표시 버전을 `0.0.10.5`, npm/Cargo/Tauri 호환 버전을 `0.0.10-5`로 올렸다.
- Normal 지갑이 포함하는 IEUM Core 기본 참조를 `v0.21.6`으로 변경했다.
- Windows Normal 빌드는 체크아웃한 Core의 Cargo 버전이 정확히 `0.21.6`인지
  검사하고, 다르면 Core 빌드 전에 즉시 실패한다.
- `v0.21.6`이 GitHub에 존재하지 않는 상태에서 월렛을 먼저 배포하지 않도록
  체인 릴리스 선행 순서를 명시했다.

## 배포 순서

1. IEUM Chain `v0.21.6`의 전체 Actions 성공을 확인한다.
2. `c4ei/ieum-chain` 저장소에 `v0.21.6` 태그가 실제로 생성됐는지 확인한다.
3. Wallet Actions를 `version=0.0.10.5`, `core_ref=v0.21.6`으로 실행한다.

`actions/checkout` 로그에 나타나는 `v0.21.6*`는 내부 검색용 refspec이며 오류가
아니다. 정확한 `v0.21.6` 태그가 존재하면 최종적으로 그 태그를 체크아웃한다.

## 다음 작업

- Windows Normal, Ubuntu Normal, Light 데스크톱 및 Android Light 산출물을 모두
  확인한 뒤 Release의 `latest.json`과 서명 파일을 검증한다.
- 체인의 실제 자동 보상 발행이 합의 업그레이드로 활성화될 때 월렛에 보상 내역과
  중계 기여 상태 화면을 추가한다.
