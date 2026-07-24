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
import {
  createDevelopmentRewardStatus,
  formatRemaining,
  remainingRewardMs,
  type RewardStatus
} from "./rewards";
import {
  addFriend,
  createGroup,
  EMPTY_SOCIAL_BOOK,
  groupRecipients,
  loadSocialBook,
  saveSocialBook,
  type SocialBook
} from "./social";

type Screen = "home" | "create" | "restore";
type Tab = "wallet" | "reward" | "social";

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
  const [tab, setTab] = useState<Tab>("wallet");
  const [rewardStatus, setRewardStatus] = useState<RewardStatus>(() =>
    createDevelopmentRewardStatus()
  );
  const [socialBook, setSocialBook] = useState<SocialBook>(EMPTY_SOCIAL_BOOK);
  const [friendName, setFriendName] = useState("");
  const [friendAddress, setFriendAddress] = useState("");
  const [groupName, setGroupName] = useState("");
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [groupId, setGroupId] = useState("");
  const [groupAmount, setGroupAmount] = useState("");

  const wallet = useMemo(() => (vault ? new Wallet(vault.privateKey) : null), [vault]);

  useEffect(() => {
    invoke<boolean>("vault_exists").then(setHasVault).catch(() => setHasVault(false));
    const savedRpc = localStorage.getItem("aah-rpc-url");
    if (savedRpc) setRpcUrl(savedRpc);
  }, []);

  useEffect(() => {
    if (vault) {
      QRCode.toDataURL(vault.address, { width: 220, margin: 1 }).then(setQr);
      setSocialBook(loadSocialBook(vault.address));
      const last = localStorage.getItem(`aah-reward-${vault.address.toLowerCase()}`) ?? undefined;
      setRewardStatus(createDevelopmentRewardStatus(last));
    }
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
        "pending"
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

  async function sendToAddress(address: string, value: bigint, nonce: number): Promise<string> {
    if (!wallet) throw new Error("지갑 잠금을 먼저 해제해 주세요.");
    const raw = await wallet.signTransaction({
      type: 0,
      chainId: CHAIN_ID,
      nonce,
      to: address,
      value,
      gasLimit: 21_000n,
      gasPrice: 1n
    });
    return rpcCall<string>(rpcUrl, "eth_sendRawTransaction", [raw]);
  }

  function updateSocial(next: SocialBook) {
    if (!vault) return;
    setSocialBook(next);
    saveSocialBook(vault.address, next);
  }

  function submitFriend(event: FormEvent) {
    event.preventDefault();
    try {
      updateSocial(addFriend(socialBook, friendName, friendAddress));
      setFriendName("");
      setFriendAddress("");
      setMessage("친구를 주소록에 저장했습니다.");
    } catch (error) {
      setMessage(String(error));
    }
  }

  function submitGroup(event: FormEvent) {
    event.preventDefault();
    try {
      const next = createGroup(socialBook, groupName, selectedFriendIds);
      updateSocial(next);
      setGroupName("");
      setSelectedFriendIds([]);
      setMessage("그룹과 초대 코드를 만들었습니다.");
    } catch (error) {
      setMessage(String(error));
    }
  }

  async function sendGroup(event: FormEvent) {
    event.preventDefault();
    if (!vault) return;
    try {
      setBusy(true);
      const recipients = groupRecipients(socialBook, groupId);
      const value = validateTransfer(recipients[0]?.address ?? "", groupAmount);
      const nonceHex = await rpcCall<string>(rpcUrl, "eth_getTransactionCount", [
        vault.address,
        "pending"
      ]);
      const firstNonce = Number(parseHexQuantity(nonceHex));
      const hashes: string[] = [];
      // 현재 체인에는 원자적 다중 송금이 없어 각 구성원에게 순차 전송합니다.
      for (let index = 0; index < recipients.length; index += 1) {
        hashes.push(await sendToAddress(recipients[index].address, value, firstNonce + index));
      }
      setTxHash(hashes.at(-1) ?? "");
      setGroupAmount("");
      setMessage(`${hashes.length}명에게 그룹 송금을 요청했습니다.`);
    } catch (error) {
      setMessage(`그룹 송금 중단: ${String(error)} (이미 접수된 거래는 취소되지 않습니다.)`);
    } finally {
      setBusy(false);
    }
  }

  function completeDevelopmentAd() {
    if (!vault) return;
    if (remainingRewardMs(rewardStatus) > 0) {
      setMessage("아직 다음 광고 보상 시간이 되지 않았습니다.");
      return;
    }
    const confirmedAt = new Date().toISOString();
    localStorage.setItem(`aah-reward-${vault.address.toLowerCase()}`, confirmedAt);
    setRewardStatus(createDevelopmentRewardStatus(confirmedAt));
    setMessage("개발 모드 광고 완료를 기록했습니다. 실제 AAH 지급은 보상 서버 연동 후 활성화됩니다.");
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
      <nav className="tabs" aria-label="주요 기능">
        <button className={tab === "wallet" ? "active" : ""} onClick={() => setTab("wallet")}>지갑</button>
        <button className={tab === "reward" ? "active" : ""} onClick={() => setTab("reward")}>광고 보상</button>
        <button className={tab === "social" ? "active" : ""} onClick={() => setTab("social")}>친구·그룹</button>
      </nav>
      {tab === "wallet" && <>
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
            <p className="muted">기본 수수료: gas 21,000 × gasPrice 1 · 큰 금액은 aah-chain v0.0.6.1 필요</p>
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
      </>}
      {tab === "reward" && (
        <section className="card reward-card">
          <span className="eyebrow">v0.0.2.1 · 개발 연동 모드</span>
          <h2>4시간마다 광고 참여 보상</h2>
          <p className="reward-time">{formatRemaining(remainingRewardMs(rewardStatus))}</p>
          <p>판정 기준은 PC 시간이 아니라 보상 서버의 확정 시각입니다.</p>
          <dl>
            <dt>마지막 확정</dt><dd>{rewardStatus.lastConfirmedAt ?? "참여 기록 없음"}</dd>
            <dt>오늘 확정 횟수</dt><dd>{rewardStatus.dailyConfirmedCount}회</dd>
          </dl>
          <button onClick={completeDevelopmentAd} disabled={remainingRewardMs(rewardStatus) > 0}>
            개발용 광고 완료 처리
          </button>
          <p className="warning">실제 광고 재생·부정 참여 검증·AAH 지급은 보상 서버 URL과 서명 규격 확정 후 활성화됩니다.</p>
        </section>
      )}
      {tab === "social" && (
        <div className="social-grid">
          <section className="card">
            <span className="eyebrow">v0.0.3.1</span>
            <h2>친구 추가</h2>
            <form className="stack" onSubmit={submitFriend}>
              <input value={friendName} onChange={(event) => setFriendName(event.target.value)}
                placeholder="표시할 이름" required />
              <input value={friendAddress} onChange={(event) => setFriendAddress(event.target.value)}
                placeholder="0x 지갑 주소" required />
              <button>주소록에 저장</button>
            </form>
            <ul className="people">
              {socialBook.friends.map((friend) => (
                <li key={friend.id}><b>{friend.name}</b><code>{friend.address}</code></li>
              ))}
            </ul>
          </section>
          <section className="card">
            <h2>그룹 만들기</h2>
            <form className="stack" onSubmit={submitGroup}>
              <input value={groupName} onChange={(event) => setGroupName(event.target.value)}
                placeholder="그룹 이름" required />
              {socialBook.friends.map((friend) => (
                <label className="check" key={friend.id}>
                  <input type="checkbox" checked={selectedFriendIds.includes(friend.id)}
                    onChange={(event) => setSelectedFriendIds((current) =>
                      event.target.checked
                        ? [...current, friend.id]
                        : current.filter((id) => id !== friend.id)
                    )} /> {friend.name}
                </label>
              ))}
              <button disabled={socialBook.friends.length === 0}>그룹 생성</button>
            </form>
            <ul className="people">
              {socialBook.groups.map((group) => (
                <li key={group.id}><b>{group.name}</b><code>{group.inviteCode}</code></li>
              ))}
            </ul>
          </section>
          <section className="card">
            <h2>그룹 송금</h2>
            <form className="stack" onSubmit={sendGroup}>
              <select value={groupId} onChange={(event) => setGroupId(event.target.value)} required>
                <option value="">그룹 선택</option>
                {socialBook.groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
              <input value={groupAmount} onChange={(event) => setGroupAmount(event.target.value)}
                inputMode="decimal" placeholder="1명당 보낼 AAH" required />
              <button disabled={busy}>구성원별 순차 전송</button>
            </form>
            <p className="warning">다중 송금 컨트랙트가 없어 일부 거래만 성공할 수 있습니다. 테스트넷에서 소액으로 확인하세요.</p>
          </section>
        </div>
      )}
      {message && <div className="toast">{message}</div>}
    </main>
  );
}
