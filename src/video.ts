export interface IceServerInput {
  urls: string;
  username?: string;
  credential?: string;
}

export interface CallAuditEvent {
  event: "permission_granted" | "permission_denied" | "call_started" | "connected" | "call_ended" | "call_failed";
  callId: string;
  roomId: string;
  occurredAt: string;
  detail?: string;
}

const SAFE_ICE_SCHEMES = /^(stun|stuns|turn|turns):/i;

export function parseIceServers(value: string): RTCIceServer[] {
  const parsed = JSON.parse(value) as IceServerInput[];
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("STUN/TURN 서버를 1개 이상 설정해 주세요.");
  }
  return parsed.map((item) => {
    if (!item || typeof item.urls !== "string" || !SAFE_ICE_SCHEMES.test(item.urls)) {
      throw new Error("ICE 서버는 stun:, stuns:, turn:, turns: 주소만 허용합니다.");
    }
    if (/^turns?:/i.test(item.urls) && (!item.username || !item.credential)) {
      throw new Error("TURN 서버에는 임시 username과 credential이 필요합니다.");
    }
    return { urls: item.urls, username: item.username, credential: item.credential };
  });
}

export function mediaConstraints(video: boolean): MediaStreamConstraints {
  return {
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    video: video ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" } : false
  };
}

export function stopMedia(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}
