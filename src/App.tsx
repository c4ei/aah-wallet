import { FormEvent, useEffect, useMemo, useState } from "react";
import { Wallet, formatEther } from "ethers";
import QRCode from "qrcode";
import { invoke } from "@tauri-apps/api/core";
import { decryptVault, encryptVault, type VaultPayload } from "./vault";
import {
  CHAIN_ID,
  createWallet,
  formatAah,
  restoreFromMnemonic,
  restoreFromPrivateKey,
  validateTransfer
} from "./wallet";
import { parseHexQuantity, rpcCall } from "./rpc";

type Screen = "home" | "create" | "restore";

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [vault, setVault] = useState<VaultPayload | null>(null);
  const [hasVault, setHasVault] = useState(false);
  const [password, setPassword] = useState("");
  const [rpcUrl, setRpcUrl] = useState("http://127.0.0.1:8545");
  const [balance, setBalance] = useState<bigint>(0n);
  const [networkOk, setNetworkOk] = useState(false);
  const [seed, setSeed] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [backupConfirmed, setBackupConfirmed] = useState(false);
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState("");

  const wallet = useMemo(() => (vault ? new Wallet(vault.privateKey) : null), [vault]);

  useEffect(() => {
    invoke<boolean>("vault_exists").then(setHasVault).catch(() => setHasVault(false));
    const savedRpc = localStorage.getItem("aah-rpc-url");
    if (savedRpc) setRpcUrl(savedRpc);
  }, []);

  useEffect(() => {
    if (vault) QRCode.toDataURL(vault.address, { width: 220, margin: 1 }).then(setQr);
  }, [vault]);

  async function saveWallet(created: { privateKey: string; address: string }, mnemonic: string) {
    if (!backupConfirmed && mnemonic) throw new Error("SEED 백업 확인에 체크해 주세요.");
    const payload: VaultPayload = {
      privateKey: created.privateKey,
      address: created.address,
      createdAt: new Date().toISOString()
    };
    const encrypted = await encryptVault(payload, password);
    await invoke("save_vault", { contents: encrypted });
    setVault(payload);
    setHasVault(true);
    setPrivateKey("");
    setSeed("");
    setMessage("지갑을 암호화하여 저장했습니다.");
    setScreen("home");
  }

  async function generate() {
    try {
      setMessage("");
      const created = createWallet();
      setSeed(created.mnemonic);
      setPrivateKey(created.privateKey);
    } catch (error) {
      setMessage(String(error));
    }
  }

  async function restore(event: FormEvent) {
    event.preventDefault();
    try {
      setBusy(true);
      const restored = seed.trim()
        ? restoreFromMnemonic(seed)
        : restoreFromPrivateKey(privateKey);
      await saveWallet(restored, seed.trim());
    } catch (error) {
      setMessage(String(error));
    } finally {
      setBusy(false);
    }
  }

  async function unlock(event: FormEvent) {
    event.preventDefault();
    try {
      const raw = await invoke<string>("load_vault");
      setVault(await decryptVault(raw, password));
      setPassword("");
      setMessage("지갑 잠금을 해제했습니다.");
    } catch (error) {
      setMessage(String(error));
    }
  }

  async function refresh() {
    if (!vault) return;
    try {
      setBusy(true);
      const chain = await rpcCall<string>(rpcUrl, "eth_chainId", []);
      if (Number(parseHexQuantity(chain)) !== CHAIN_ID) {
        throw new Error(`AAH Chain ID(${CHAIN_ID})가 아닌 노드입니다.`);
      }
      const value = await rpcCall<string>(rpcUrl, "eth_getBalance", [vault.address, "latest"]);
      setBalance(parseHexQuantity(value));
      setNetworkOk(true);
      localStorage.setItem("aah-rpc-url", rpcUrl);
      setMessage("잔액을 새로 확인했습니다.");
    } catch (error) {
      setNetworkOk(false);
      setMessage(String(error));
    } finally {
      setBusy(false);
    }
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!wallet || !vault) return;
    try {
      setBusy(true);
      const value = validateTransfer(to, amount);
      const nonceHex = await rpcCall<string>(rpcUrl, "eth_getTransactionCount", [
        vault.address,
        "latest"
      ]);
      // aah-chain v0.0.5.2가 지원하는 EIP-155 legacy(type-0) 거래를 로컬 서명합니다.
      const raw = await wallet.signTransaction({
        type: 0,
        chainId: CHAIN_ID,
        nonce: Number(parseHexQuantity(nonceHex)),
        to,
        value,
        gasLimit: 21_000n,
        gasPrice: 1n
      });
      const hash = await rpcCall<string>(rpcUrl, "eth_sendRawTransaction", [raw]);
      setTxHash(hash);
      setAmount("");
      setTo("");
      setMessage("전송 요청이 처리되었습니다.");
      await refresh();
    } catch (error) {
      setMessage(String(error));
    } finally {
      setBusy(false);
    }
  }

  function lock() {
    setVault(null);
    setBalance(0n);
    setPassword("");
    setMessage("지갑을 잠갔습니다.");
  }

  if (!vault) {
    return (
      <main className="shell narrow">
        <header><span className="logo">A</span><div><h1>AAH Wallet</h1><p>가볍고 안전한 AAH 지갑</p></div></header>
        {screen === "home" && (
          <section className="card hero">
            <span className="eyebrow">CHAIN ID {CHAIN_ID}</span>
            <h2>{hasVault ? "다시 오신 것을 환영해요" : "첫 지갑을 만들어 볼까요?"}</h2>
            {hasVault ? (
              <form onSubmit={unlock} className="stack">
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="지갑 비밀번호" required />
                <button disabled={busy}>지갑 열기</button>
              </form>
            ) : (
              <div className="actions">
                <button onClick={() => { setScreen("create"); generate(); }}>새 지갑 만들기</button>
                <button className="secondary" onClick={() => setScreen("restore")}>지갑 복원</button>
              </div>
            )}
          </section>
        )}
        {screen === "create" && (
          <section className="card">
            <button className="text-button" onClick={() => setScreen("home")}>← 돌아가기</button>
            <h2>SEED를 반드시 적어 두세요</h2>
            <p className="warning">아래 12단어를 잃으면 지갑을 복구할 수 없습니다. 누구에게도 보여주지 마세요.</p>
            <div className="seed-grid">{seed.split(" ").map((word, i) => <span key={i}><b>{i + 1}</b>{word}</span>)}</div>
            <label className="check"><input type="checkbox" checked={backupConfirmed}
              onChange={(e) => setBackupConfirmed(e.target.checked)} /> 오프라인에 안전하게 백업했습니다.</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="암호화 비밀번호(8자 이상)" />
            <button onClick={() => saveWallet(new Wallet(privateKey), seed).catch((e) => setMessage(String(e)))}
              disabled={!seed || !backupConfirmed}>지갑 저장</button>
          </section>
        )}
        {screen === "restore" && (
          <section className="card">
            <button className="text-button" onClick={() => setScreen("home")}>← 돌아가기</button>
            <h2>기존 지갑 복원</h2>
            <form onSubmit={restore} className="stack">
              <textarea value={seed} onChange={(e) => setSeed(e.target.value)}
                placeholder="12단어 SEED (SEED 또는 개인키 중 하나)" />
              <div className="divider">또는</div>
              <input type="password" value={privateKey} onChange={(e) => setPrivateKey(e.target.value)}
                placeholder="0x로 시작하는 Private Key" />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="새 지갑 비밀번호(8자 이상)" required />
              {seed && <label className="check"><input type="checkbox" checked={backupConfirmed}
                onChange={(e) => setBackupConfirmed(e.target.checked)} /> SEED 백업 책임을 확인했습니다.</label>}
              <button disabled={busy || (!seed && !privateKey)}>복원하고 저장</button>
            </form>
          </section>
        )}
        {message && <div className="toast">{message}</div>}
      </main>
    );
  }

  return (
    <main className="shell">
      <header><span className="logo">A</span><div><h1>AAH Wallet</h1><p className={networkOk ? "online" : ""}>● {networkOk ? "연결됨" : "연결 확인 필요"}</p></div><button className="secondary small" onClick={lock}>잠금</button></header>
      <section className="balance-card">
        <span>사용 가능 잔액</span><strong>{formatAah(balance)}</strong>
        <code>{vault.address}</code>
        <div className="balance-actions"><button onClick={refresh} disabled={busy}>새로고침</button>{qr && <img src={qr} alt="내 지갑 주소 QR" />}</div>
      </section>
      <div className="columns">
        <section className="card">
          <h2>AAH 보내기</h2>
          <form onSubmit={send} className="stack">
            <label>받는 주소<input value={to} onChange={(e) => setTo(e.target.value)} placeholder="0x..." required /></label>
            <label>수량<input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.0" required /></label>
            <p className="muted">현재 테스트넷 수수료: 21,000 최소 단위 · 1회 최대 약 18.44 AAH</p>
            <button disabled={busy}>확인 후 전송</button>
          </form>
        </section>
        <section className="card">
          <h2>네트워크 설정</h2>
          <label>AAH 노드 RPC<input value={rpcUrl} onChange={(e) => setRpcUrl(e.target.value)} /></label>
          <button className="secondary" onClick={refresh}>연결 테스트</button>
          <dl><dt>Chain ID</dt><dd>{CHAIN_ID}</dd><dt>파생 경로</dt><dd>m/44'/60'/0'/0/0</dd></dl>
        </section>
      </div>
      <section className="card">
        <h2>최근 전송</h2>
        {txHash ? <p><code>{txHash}</code><br/><small>노드 또는 Explorer에서 이 해시로 확인할 수 있습니다.</small></p>
          : <p className="muted">이 앱을 연 뒤 전송한 거래가 아직 없습니다.</p>}
      </section>
      {message && <div className="toast">{message}</div>}
    </main>
  );
}
