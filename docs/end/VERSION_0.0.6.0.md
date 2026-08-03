# IEUM Wallet v0.0.6.0

## 구현 범위

- 친구 1명을 선택하는 1:1 WebRTC 음성·영상 통화
- 브라우저 WebRTC의 DTLS 키 합의와 SRTP 미디어 암호화
- IEUM Chain `ieum_sendCommunication`을 이용한 AES-256-GCM 신호 교환
- 통화 시작 직전에 카메라·마이크 권한 요청
- 카메라를 끈 음성 전용 통화
- STUN/TURN 서버 JSON 설정
- 앱 데이터 폴더의 별도 `call-audit.jsonl` 감사 로그

그룹 화상회의, 통화 녹화, 서버 보관, 푸시 기반 수신 알림은 이번 버전에 포함하지
않았습니다.

## 감사 범위

감사 파일에는 다음 메타데이터만 한 줄 JSON으로 기록합니다.

- 권한 허용·거절
- 통화 시작·연결·종료·실패
- 무작위 통화 ID, 방 ID, 발생 시각, 제한된 오류 설명

음성, 영상, 채팅 본문, SDP, ICE 후보, TURN 비밀번호, 지갑 개인키는 감사 파일에
기록하지 않습니다. 이 파일은 블록체인 원장이나 서버 DB로 전송하지 않습니다.

## STUN/TURN 운영

화면의 `STUN/TURN 운영 설정`에 다음 형태의 JSON 배열을 입력합니다.

```json
[
  { "urls": "stun:stun.ieum.aah.name:3478" },
  {
    "urls": "turns:turn.ieum.aah.name:5349",
    "username": "서버가 발급한-단기-사용자",
    "credential": "서버가 발급한-단기-비밀번호"
  }
]
```

예시 도메인은 실제 DNS·인증서·coturn 배포가 완료된 뒤 사용해야 합니다.
운영에서는 UDP/TCP 3478과 TLS 5349, TURN relay 포트 범위를 방화벽에 열고,
`realm`, 외부 공인 IP, TLS 인증서를 설정합니다. 장기 고정 비밀번호를 앱에
포함하지 말고 REST 인증 방식으로 5~30분짜리 자격증명을 발급하는 구성을 권장합니다.

STUN만으로는 대칭 NAT나 일부 회사·통신사망에서 연결되지 않으므로 실제 배포에는
TURN이 필요합니다.

## 모바일 권한

`npm run tauri android init` 또는 `npm run tauri ios init` 후 생성되는 네이티브
프로젝트에 다음 권한을 넣습니다.

- Android `AndroidManifest.xml`: `android.permission.CAMERA`,
  `android.permission.RECORD_AUDIO`, `android.permission.MODIFY_AUDIO_SETTINGS`,
  `android.permission.INTERNET`
- iOS `Info.plist`: `NSCameraUsageDescription`,
  `NSMicrophoneUsageDescription`

권한 설명은 “IEUM 친구와 음성·영상 통화를 연결하기 위해 사용”처럼 실제 목적을
명확히 적습니다. 생성된 네이티브 프로젝트를 저장소에 포함하는 시점에 이 선언도
같이 버전 관리해야 합니다.

## 확인 명령

```bash
npm ci
npm run build
npm test
cd src-tauri
cargo fmt --all --check
cargo test --locked
```

두 장치에서 서로 다른 PeerId를 등록하고 같은 64자리 방 키를 설정합니다. TURN
검증은 한 장치를 다른 네트워크에 두거나 `iceTransportPolicy: "relay"`인 별도
시험 빌드로 relay 후보와 양방향 음성·영상을 확인합니다.
