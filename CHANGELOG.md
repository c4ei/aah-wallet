# 변경 이력

## 0.0.9.3 - 2026-08-04

- Windows와 Ubuntu 데스크톱 월렛에 서명 검증 기반 자동 업데이트 추가
- 실행 시 GitHub Release의 최신 버전을 확인하고 현재 OS용 번들만 설치
- Actions에서 OS별 업데이트 번들, 서명 및 `latest.json` 자동 게시
- 고정돼 있던 Actions 버전과 Artifact 이름을 `0.0.9.3`으로 변경
- npm/Cargo/Tauri 내부 SemVer는 `0.0.9-3`, 배포 표기는 `0.0.9.3`으로 통일

## 0.0.9.2 - 2026-08-04

- IEUM Chain v0.21.4의 운영 제네시스 해시로 월렛 검증값 갱신
- `0x475e…817` 테스트 주소에 100 IEUM이 포함된 운영망 노드 연결 허용
- Chain ID와 운영 제네시스 식별자가 다시 어긋나지 않도록 회귀 테스트 추가
- npm/Cargo/Tauri 내부 SemVer는 `0.0.9-2`, 배포 표기는 `0.0.9.2`로 통일

## 0.0.9.1 - 2026-08-03

- GitHub Actions 한 번의 실행으로 Windows, Ubuntu, Android 빌드
- Windows NSIS 설치 파일과 MSI, Ubuntu AppImage와 DEB, Android ARM64 APK 생성
- Actions Artifacts에서 운영체제별 결과물 다운로드 지원
- npm/Cargo/Tauri 내부 SemVer는 `0.0.9-1`, 배포 표기는 `0.0.9.1`로 통일

## 0.0.9-0 - 2026-08-03

- IEUM Chain v0.21.0 운영 상태 RPC 연동
- Chain ID와 운영 제네시스 해시 동시 검증
- 노드 버전·피어·동기화율·최종 확정 블록·복구 상태 표시
- 동기화 미완료 또는 사고 복구 처리 중 송금 차단

## 0.0.7-0 - 2026-07-29

- 5·15·30분 미사용 자동 잠금과 백그라운드 전환 즉시 잠금
- 친구·그룹 주소록 AES-256-GCM 암호화 및 기존 평문 자료 자동 이전
- 최근 200건 통화 감사 기록 조회와 사용자 직접 삭제
- 감사 기록 읽기·삭제 Rust 명령 및 회귀 테스트 추가

## 0.0.6-0 - 2026-07-29

- 1:1 WebRTC 음성·영상 통화와 DTLS-SRTP 미디어 보호
- 기존 IEUM 암호화 통신을 통한 offer/answer/ICE 신호 교환
- 카메라·마이크 권한 거절 처리와 음성 전용 선택
- STUN/TURN 운영 JSON 설정, TURN 인증값 검증
- 통화 내용과 분리된 로컬 `call-audit.jsonl` 감사 메타데이터
- 통화 종료 시 카메라·마이크 트랙과 PeerConnection 정리

## 0.0.4-3 - 2026-07-27

- IEUM Chain의 `--rpc-port` 실행 연결 누락에 맞춰 설치·실행 안내 수정
- RPC가 404, HTML 또는 빈 본문을 반환할 때 실제 HTTP 상태와 응답 일부 표시
- `package.json`, Tauri Rust 패키지, `tauri.conf.json`, 화면 버전을 `0.0.4-3`으로 통일
- 기존 AAH/geth(Chain ID 21133)와 IEUM(Chain ID 21004) 명칭 혼용 정리
- CEX 간편교환 API 미배포 상태는 오류를 숨기지 않고 안전하게 중단

## 0.0.4-1 - 2026-07-27

- TRON(TRC20), Solana(SPL), BSC(BEP20) USDT 입금 네트워크 선택 화면
- USDT 입금주소·QR, 입금 확인, IEUM 교환 견적, 현재 지갑 출금 흐름
- 재단 서비스 수수료·네트워크 비용·최소 수령액 명시
- `cex.aah.name/api/v1/simple-swap/*` 전용 Tauri API 프록시
- CEX API 오류 시 교환·출금을 중단하는 실패 안전 처리
- USDT 수량과 견적 만료 단위 테스트

## 0.0.3-2 - 2026-07-24

- 처음 실행 시 닉네임과 선택 이메일을 받는 쉬운 시작 안내
- 내 주소 복사와 송금 최종 확인 화면
- `aah.name`을 지갑 IPC 권한이 없는 별도 웹 창으로 여는 메뉴
- 모바일 메뉴 배치 개선
- 사용자 프로필 검증 테스트 2개 추가

## 0.0.1.1 - 2026-07-24

- `ieum-wallet` 신규 Tauri 2 프로젝트 생성
- 신규 지갑과 SEED/Private Key 복원
- AES-256-GCM 암호화 지갑 파일
- Chain ID 21004 잔액·nonce·raw transaction 연동
- RPC 주소 설정, QR 주소, 잠금 화면
- 한국어 주석과 버전·테스트·보안·로드맵 문서
# 0.0.3-1

- 친구 주소록, 그룹, 초대 코드와 그룹 순차 송금 추가
- 친구·그룹 단위 테스트와 한국어 문서 추가

# 0.0.2-1

- 서버 시각 기준 4시간 광고 보상 정책과 개발 모드 UI 추가
- 실제 보상 서버 API 계약 및 테스트 문서 추가
## 0.0.3-3 - 2026-07-24

- `package.json`, Tauri 설정, Rust 패키지 버전을 `0.0.3-3`으로 통일
- 데스크톱은 격리된 별도 WebView, Android/iOS는 시스템 브라우저로 `aah.name` 열기
- Windows, Linux, Android, iOS 설치·빌드 설명서 추가
# 0.0.4-2

- CEX 응답을 HTTP 상태 확인 전에 JSON으로 해석하던 문제를 수정했습니다.
- 간편교환 API가 없을 때 HTTP 상태, 요청 경로, 안전하게 제한한 서버 응답을 표시합니다.
- 빈 본문과 HTML 프록시 오류를 구분하고 관련 단위 테스트를 추가했습니다.
# v0.0.5.0

- IEUM Chain v0.18.0 통신 RPC 연결
- peer 간 1:1 및 1:n AES-256-GCM 암호화 채팅
- 그룹 방장·부방장·청중 역할 모델과 부방장 지정 UI
- 친구 주소록에 통신 PeerId 추가 및 기존 v1 주소록 자동 변환
- 메시지 길이, PeerId, 암호문과 방 키 검증
- 채팅 평문은 체인 원장과 서버 DB에 저장하지 않음
