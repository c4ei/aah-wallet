import { rpcCall } from "./rpc";
import type { Friend } from "./social";

export type ChatScope = "direct" | "group";

export interface ChatMessage {
  packetType?: "chat";
  id: string;
  scope: ChatScope;
  roomId: string;
  senderAddress: string;
  senderName: string;
  text: string;
  sentAt: string;
}

export interface CallSignal {
  packetType: "call_signal";
  id: string;
  roomId: string;
  senderAddress: string;
  callId: string;
  signalType: "offer" | "answer" | "ice" | "hangup";
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  sentAt: string;
}

export type CommunicationPayload = ChatMessage | CallSignal;

export interface CommunicationEnvelope {
  id: string;
  sender_peer_id: string;
  target_peer_id: string;
  kind: "encrypted_chat";
  created_at: number;
  expires_at: number;
  encrypted_payload_hex: string;
}

const MAX_MESSAGE_LENGTH = 4000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array {
  if (!/^(?:[0-9a-f]{2})+$/i.test(hex)) throw new Error("암호문 형식이 올바르지 않습니다.");
  return Uint8Array.from(hex.match(/.{2}/g) ?? [], (pair) => Number.parseInt(pair, 16));
}

function arrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return new Uint8Array(bytes).buffer;
}

export function createRoomSecret(): string {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
}

async function aesKey(secret: string): Promise<CryptoKey> {
  const raw = hexToBytes(secret);
  if (raw.length !== 32) throw new Error("채팅방 보안 키가 올바르지 않습니다.");
  return crypto.subtle.importKey("raw", arrayBuffer(raw), "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptChat(message: ChatMessage, secret: string): Promise<string> {
  if (!message.text.trim() || message.text.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`메시지는 1~${MAX_MESSAGE_LENGTH}자로 입력해 주세요.`);
  }
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: arrayBuffer(nonce) },
    await aesKey(secret),
    arrayBuffer(encoder.encode(JSON.stringify(message)))
  );
  const combined = new Uint8Array(nonce.length + ciphertext.byteLength);
  combined.set(nonce);
  combined.set(new Uint8Array(ciphertext), nonce.length);
  return bytesToHex(combined);
}

async function encryptPayload(payload: CommunicationPayload, secret: string): Promise<string> {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: arrayBuffer(nonce) },
    await aesKey(secret),
    arrayBuffer(encoder.encode(JSON.stringify(payload)))
  );
  const combined = new Uint8Array(nonce.length + ciphertext.byteLength);
  combined.set(nonce);
  combined.set(new Uint8Array(ciphertext), nonce.length);
  return bytesToHex(combined);
}

export async function decryptCommunication(
  payloadHex: string,
  secret: string
): Promise<CommunicationPayload> {
  const combined = hexToBytes(payloadHex);
  if (combined.length < 29) throw new Error("암호문이 너무 짧습니다.");
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: arrayBuffer(combined.slice(0, 12)) },
    await aesKey(secret),
    arrayBuffer(combined.slice(12))
  );
  const value = JSON.parse(decoder.decode(plain)) as CommunicationPayload;
  if (!value.id || !value.roomId || !value.senderAddress || !value.sentAt) {
    throw new Error("복호화한 메시지 형식이 올바르지 않습니다.");
  }
  if (value.packetType === "call_signal") {
    if (!value.callId || !["offer", "answer", "ice", "hangup"].includes(value.signalType)) {
      throw new Error("통화 신호 형식이 올바르지 않습니다.");
    }
    return value;
  }
  if (!value.text) throw new Error("채팅 메시지 형식이 올바르지 않습니다.");
  return value;
}

export async function decryptChat(payloadHex: string, secret: string): Promise<ChatMessage> {
  const value = await decryptCommunication(payloadHex, secret);
  if (value.packetType === "call_signal") throw new Error("채팅 메시지가 아닙니다.");
  return value;
}

export async function sendEncryptedChat(
  rpcUrl: string,
  recipients: Friend[],
  message: ChatMessage,
  roomSecret: string
): Promise<number> {
  const encrypted = await encryptChat(message, roomSecret);
  const now = Math.floor(Date.now() / 1000);
  for (const recipient of recipients) {
    if (!recipient.peerId) throw new Error(`${recipient.name}님의 PeerId가 없습니다.`);
    const envelope: CommunicationEnvelope = {
      id: `${message.id}_${recipient.id}`.replace(/[^a-zA-Z0-9_-]/g, "_"),
      sender_peer_id: "",
      target_peer_id: recipient.peerId,
      kind: "encrypted_chat",
      created_at: now,
      expires_at: now + 90,
      encrypted_payload_hex: encrypted
    };
    await rpcCall<string>(rpcUrl, "ieum_sendCommunication", [envelope]);
  }
  return recipients.length;
}

export async function pollEncryptedChat(rpcUrl: string): Promise<CommunicationEnvelope[]> {
  return rpcCall<CommunicationEnvelope[]>(rpcUrl, "ieum_pollCommunication", []);
}

export async function sendEncryptedSignal(
  rpcUrl: string,
  recipients: Friend[],
  signal: CallSignal,
  roomSecret: string
): Promise<void> {
  const encrypted = await encryptPayload(signal, roomSecret);
  const now = Math.floor(Date.now() / 1000);
  for (const recipient of recipients) {
    if (!recipient.peerId) throw new Error(`${recipient.name}님의 PeerId가 없습니다.`);
    await rpcCall<string>(rpcUrl, "ieum_sendCommunication", [{
      id: `${signal.id}_${recipient.id}`.replace(/[^a-zA-Z0-9_-]/g, "_"),
      sender_peer_id: "",
      target_peer_id: recipient.peerId,
      // ieum-chain v0.18.0과 호환되는 암호화 통신 종류 안에 신호를 넣습니다.
      kind: "encrypted_chat",
      created_at: now,
      expires_at: now + 90,
      encrypted_payload_hex: encrypted
    } satisfies CommunicationEnvelope]);
  }
}
