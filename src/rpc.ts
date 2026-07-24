import { invoke } from "@tauri-apps/api/core";

interface RpcEnvelope<T> {
  jsonrpc: "2.0";
  id: number;
  result?: T;
  error?: { code: number; message: string };
}

let requestId = 0;

// 브라우저 CORS 제한과 RPC 주소 검증을 Rust 계층에서 한 번에 처리합니다.
export async function rpcCall<T>(rpcUrl: string, method: string, params: unknown[]): Promise<T> {
  const response = await invoke<RpcEnvelope<T>>("rpc_call", {
    rpcUrl,
    method,
    params,
    id: ++requestId
  });
  if (response.error) throw new Error(response.error.message);
  if (response.result === undefined) throw new Error("RPC 응답에 result가 없습니다.");
  return response.result;
}

export function parseHexQuantity(value: string): bigint {
  if (!/^0x[0-9a-f]+$/i.test(value)) throw new Error("노드가 잘못된 수량을 반환했습니다.");
  return BigInt(value);
}
