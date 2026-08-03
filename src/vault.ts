import { Wallet } from "ethers";

export interface VaultPayload {
  privateKey: string;
  address: string;
  createdAt: string;
}

export interface EncryptedVault {
  version: 1;
  kdf: "PBKDF2-SHA256";
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const ITERATIONS = 310_000;

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  // TypeScript 5.7 이후 SharedArrayBuffer 가능성을 분리하기 위해 새 버퍼로 복사합니다.
  return Uint8Array.from(bytes).buffer;
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number) {
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: asArrayBuffer(salt), iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptLocalData<T>(payload: T, secret: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(`ieum-local-data:${secret}`, salt, ITERATIONS);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: asArrayBuffer(iv) },
    key,
    encoder.encode(JSON.stringify(payload))
  );
  return JSON.stringify({
    version: 1,
    kdf: "PBKDF2-SHA256",
    iterations: ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(encrypted))
  } satisfies EncryptedVault);
}

export async function decryptLocalData<T>(raw: string, secret: string): Promise<T> {
  const encrypted = JSON.parse(raw) as EncryptedVault;
  if (encrypted.version !== 1 || encrypted.kdf !== "PBKDF2-SHA256") {
    throw new Error("지원하지 않는 로컬 보안 데이터입니다.");
  }
  const key = await deriveKey(
    `ieum-local-data:${secret}`,
    fromBase64(encrypted.salt),
    encrypted.iterations
  );
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: asArrayBuffer(fromBase64(encrypted.iv)) },
    key,
    asArrayBuffer(fromBase64(encrypted.ciphertext))
  );
  return JSON.parse(decoder.decode(plain)) as T;
}

// 개인키는 평문으로 디스크에 저장하지 않고 AES-256-GCM으로 암호화합니다.
export async function encryptVault(payload: VaultPayload, password: string): Promise<string> {
  if (password.length < 8) throw new Error("비밀번호는 8자 이상이어야 합니다.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, ITERATIONS);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: asArrayBuffer(iv) },
    key,
    encoder.encode(JSON.stringify(payload))
  );
  const vault: EncryptedVault = {
    version: 1,
    kdf: "PBKDF2-SHA256",
    iterations: ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(encrypted))
  };
  return JSON.stringify(vault);
}

export async function decryptVault(raw: string, password: string): Promise<VaultPayload> {
  try {
    const vault = JSON.parse(raw) as EncryptedVault;
    if (vault.version !== 1 || vault.kdf !== "PBKDF2-SHA256") {
      throw new Error("지원하지 않는 지갑 파일입니다.");
    }
    const key = await deriveKey(password, fromBase64(vault.salt), vault.iterations);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: asArrayBuffer(fromBase64(vault.iv)) },
      key,
      asArrayBuffer(fromBase64(vault.ciphertext))
    );
    const payload = JSON.parse(decoder.decode(plain)) as VaultPayload;
    const verified = new Wallet(payload.privateKey);
    if (verified.address.toLowerCase() !== payload.address.toLowerCase()) {
      throw new Error("지갑 주소 검증에 실패했습니다.");
    }
    return payload;
  } catch {
    throw new Error("비밀번호가 틀렸거나 지갑 파일이 손상되었습니다.");
  }
}
