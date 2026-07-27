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
import {
  EMPTY_PROFILE,
  loadProfile,
  saveProfile,
  type UserProfile
} from "./profile";
import {
  createDepositSession,
  executeSwap,
  getSwapStatus,
  quoteIsExpired,
  requestQuote,
  USDT_NETWORKS,
  validateUsdtAmount,
  withdrawAah,
  type DepositSession,
  type SwapProgress,
  type SwapQuote,
  type UsdtNetwork
} from "./exchange";

type Screen = "home" | "create" | "restore";
type Tab = "wallet" | "exchange" | "reward" | "social" | "site" | "profile";

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
  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [pendingTransfer, setPendingTransfer] = useState<{ to: string; amount: string } | null>(null);
  const [usdtNetwork, setUsdtNetwork] = useState<UsdtNetwork>("TRON");
  const [deposit, setDeposit] = useState<DepositSession | null>(null);
  const [depositQr, setDepositQr] = useState("");
  const [swapProgress, setSwapProgress] = useState<SwapProgress | null>(null);
  const [usdtAmount, setUsdtAmount] = useState("");
  const [swapQuote, setSwapQuote] = useState<SwapQuote | null>(null);

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
      const savedProfile = loadProfile(vault.address);
      setProfile(savedProfile);
      setShowOnboarding(!savedProfile.onboardingDone);
    }
  }, [vault]);

  useEffect(() => {
    if (!deposit?.depositAddress) {
      setDepositQr("");
      return;
    }
    QRCode.toDataURL(deposit.depositAddress, { width: 220, margin: 1 }).then(setDepositQr);
  }, [deposit]);

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

  function requestSend(event: FormEvent) {
    event.preventDefault();
    try {
      validateTransfer(to, amount);
      setPendingTransfer({ to, amount });
    } catch (error) {
      setMessage(String(error));
    }
  }

  async function send() {
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
      setPendingTransfer(null);
    }
  }

  function storeProfile(event: FormEvent) {
    event.preventDefault();
    if (!vault) return;
    try {
      const saved = saveProfile(vault.address, { ...profile, onboardingDone: true });
      setProfile(saved);
      setShowOnboarding(false);
      setMessage("내 정보를 저장했습니다. 이메일은 이 기기에만 보관됩니다.");
    } catch (error) {
      setMessage(String(error));
    }
  }

  async function copyAddress() {
    if (!vault) return;
    await navigator.clipboard.writeText(vault.address);
    setMessage("내 지갑 주소를 복사했습니다.");
  }

  async function openAahSite() {
    try {
      await invoke("open_aah_site");
      setMessage("AAH 사이트를 별도 보안 창으로 열었습니다.");
    } catch (error) {
      setMessage(String(error));
    }
  }

  async function beginUsdtDeposit() {
    if (!vault) return;
    try {
      setBusy(true);
      setSwapQuote(null);
      setSwapProgress(null);
      const session = await createDepositSession(usdtNetwork, vault.address);
      setDeposit(session);
      setMessage(`${usdtNetwork} USDT 전용 입금주소를 발급했습니다.`);
    } catch (error) {
      setMessage(`USDT 입금 서비스를 시작하지 못했습니다: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function refreshSwap() {
    if (!deposit) return;
    try {
      setBusy(true);
      const progress = await getSwapStatus(deposit.swapId);
      setSwapProgress(progress);
      if (progress.depositedAmount) setUsdtAmount(progress.depositedAmount);
      setMessage("입금 및 교환 상태를 새로 확인했습니다.");
    } catch (error) {
      setMessage(String(error));
    } finally {
      setBusy(false);
    }
  }

  async function quoteSwap() {
    if (!deposit) return;
    try {
      setBusy(true);
      const value = validateUsdtAmount(usdtAmount);
      const quote = await requestQuote(deposit.swapId, value);
      setSwapQuote(quote);
      setMessage("AAH 교환 견적을 받았습니다. 만료 전에 내용을 확인해 주세요.");
    } catch (error) {
      setMessage(String(error));
    } finally {
      setBusy(false);
    }
  }

  async function confirmSwap() {
    if (!swapQuote) return;
    if (quoteIsExpired(swapQuote)) {
      setSwapQuote(null);
      setMessage("견적이 만료되었습니다. 새 견적을 받아 주세요.");
      return;
    }
    try {
      setBusy(true);
      setSwapProgress(await executeSwap(swapQuote.quoteId));
      setMessage("USDT를 AAH로 교환했습니다. 이제 내 지갑으로 받을 수 있습니다.");
    } catch (error) {
      setMessage(String(error));
    } finally {
      setBusy(false);
    }
  }

  async function receiveAah() {
    if (!deposit || !vault) return;
    try {
      setBusy(true);
      setSwapProgress(await withdrawAah(deposit.swapId, vault.address));
      setMessage("내 AAH 지갑으로 출금을 요청했습니다.");
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
      <header><span className="logo">A</span><div><h1>{profile.nickname || "AAH Wallet"}</h1><p className={networkOk ? "online" : ""}>● {networkOk ? "AAH 네트워크 연결됨" : "연결 확인 필요"}</p></div><button className="secondary small" onClick={lock}>잠금</button></header>
      <nav className="tabs" aria-label="주요 기능">
        <button className={tab === "wallet" ? "active" : ""} onClick={() => setTab("wallet")}>지갑</button>
        <button className={tab === "exchange" ? "active" : ""} onClick={() => setTab("exchange")}>USDT 교환</button>
        <button className={tab === "reward" ? "active" : ""} onClick={() => setTab("reward")}>광고 보상</button>
        <button className={tab === "social" ? "active" : ""} onClick={() => setTab("social")}>친구·그룹</button>
        <button className={tab === "site" ? "active" : ""} onClick={() => setTab("site")}>AAH 사이트</button>
        <button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}>내 정보</button>
      </nav>
      {tab === "wallet" && <>
      <section className="balance-card">
        <span>사용 가능 잔액</span><strong>{formatAah(balance)}</strong>
        <code>{vault.address}</code>
        <div className="balance-actions"><button onClick={refresh} disabled={busy}>잔액 새로고침</button><button className="secondary" onClick={copyAddress}>주소 복사</button>{qr && <img src={qr} alt="내 지갑 주소 QR" />}</div>
      </section>
      <div className="columns">
        <section className="card">
          <h2>AAH 보내기</h2>
          <form onSubmit={requestSend} className="stack">
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
      {tab === "exchange" && (
        <section className="exchange-layout">
          <div className="card exchange-hero">
            <span className="eyebrow">AAH SIMPLE SWAP · v0.0.4.1</span>
            <h2>USDT로 AAH 받기</h2>
            <p>입금 네트워크를 고르고, 입금이 확인되면 AAH로 교환한 뒤 현재 지갑으로 받습니다.</p>
            <ol className="swap-steps">
              <li className={deposit ? "done" : "active"}><b>1</b><span>USDT 입금</span></li>
              <li className={swapProgress?.status === "SWAPPED" || swapProgress?.status === "COMPLETED" ? "done" : deposit ? "active" : ""}><b>2</b><span>AAH 교환</span></li>
              <li className={swapProgress?.status === "COMPLETED" ? "done" : swapProgress?.status === "SWAPPED" ? "active" : ""}><b>3</b><span>내 지갑으로 받기</span></li>
            </ol>
          </div>

          <div className="columns">
            <section className="card">
              <h2>1. 입금 네트워크</h2>
              <div className="network-options">
                {USDT_NETWORKS.map((network) => (
                  <button key={network.id} className={usdtNetwork === network.id ? "network-option active" : "network-option"}
                    onClick={() => { setUsdtNetwork(network.id); setDeposit(null); setSwapQuote(null); }}>
                    <b>{network.label} <small>{network.standard}</small></b>
                    <span>{network.description}</span>
                  </button>
                ))}
              </div>
              <button onClick={beginUsdtDeposit} disabled={busy}>USDT 입금주소 받기</button>
              <p className="warning">선택한 네트워크의 USDT만 보내세요. 다른 네트워크로 입금하면 복구되지 않을 수 있습니다.</p>
            </section>

            <section className="card deposit-card">
              <h2>USDT 입금</h2>
              {deposit ? <>
                {depositQr && <img src={depositQr} alt={`${deposit.network} USDT 입금주소 QR`} />}
                <code>{deposit.depositAddress}</code>
                {deposit.memo && <p><b>MEMO/TAG:</b> <code>{deposit.memo}</code></p>}
                <dl>
                  <dt>최소 입금</dt><dd>{deposit.minimumDeposit} USDT</dd>
                  <dt>필요 확인</dt><dd>{deposit.confirmationsRequired}회</dd>
                  <dt>상태</dt><dd>{swapProgress?.status ?? deposit.status}</dd>
                </dl>
                <button className="secondary" onClick={refreshSwap} disabled={busy}>입금 확인</button>
              </> : <p className="muted">왼쪽에서 네트워크를 선택해 전용 입금주소를 발급받으세요.</p>}
            </section>
          </div>

          <div className="columns">
            <section className="card">
              <h2>2. AAH로 교환</h2>
              <label>확인된 USDT 수량
                <input value={usdtAmount} onChange={(event) => setUsdtAmount(event.target.value)}
                  inputMode="decimal" placeholder="예: 100" />
              </label>
              <button onClick={quoteSwap} disabled={busy || !deposit}>교환 견적 보기</button>
              {swapQuote && <div className="quote-box">
                <dl>
                  <dt>교환 전</dt><dd>{swapQuote.grossAah} AAH</dd>
                  <dt>재단 수수료</dt><dd>{swapQuote.foundationFeeAah} AAH</dd>
                  <dt>출금 비용</dt><dd>{swapQuote.networkFeeAah} AAH</dd>
                  <dt>최소 수령</dt><dd><strong>{swapQuote.minimumReceivedAah} AAH</strong></dd>
                  <dt>견적 만료</dt><dd>{new Date(swapQuote.expiresAt).toLocaleString()}</dd>
                </dl>
                <button onClick={confirmSwap} disabled={busy}>이 견적으로 교환</button>
              </div>}
            </section>

            <section className="card">
              <h2>3. 내 지갑으로 받기</h2>
              <p className="muted">출금 주소는 잠금 해제된 현재 지갑으로 고정됩니다.</p>
              <code>{vault.address}</code>
              <button onClick={receiveAah}
                disabled={busy || !deposit || !["SWAPPED", "WITHDRAWING"].includes(swapProgress?.status ?? "")}>
                AAH 받기
              </button>
              {swapProgress?.txHash && <p>출금 거래<br/><code>{swapProgress.txHash}</code></p>}
              <p className="custody-note">입금 USDT는 고객 지급 의무가 있는 준비금입니다. 재단 수익은 견적에 표시된 서비스 수수료만 별도 회계 처리합니다.</p>
            </section>
          </div>
        </section>
      )}
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
      {tab === "profile" && (
        <section className="card profile-card">
          <span className="eyebrow">이 기기에만 저장</span>
          <h2>내 정보</h2>
          <form className="stack" onSubmit={storeProfile}>
            <label>닉네임<input value={profile.nickname}
              onChange={(event) => setProfile({ ...profile, nickname: event.target.value })}
              placeholder="예: 아하친구" maxLength={24} required /></label>
            <label>이메일 (선택)<input type="email" value={profile.email}
              onChange={(event) => setProfile({ ...profile, email: event.target.value })}
              placeholder="기기 변경 안내용으로 추후 서버 연동" /></label>
            <button>저장</button>
          </form>
          <p className="muted">현재 이메일은 로그인이나 지갑 복구에 사용되지 않으며 서버로 전송하지 않습니다. 지갑 복구에는 반드시 12단어 SEED가 필요합니다.</p>
        </section>
      )}
      {tab === "site" && (
        <section className="card site-card">
          <span className="eyebrow">AAH OFFICIAL</span>
          <h2>aah.name</h2>
          <p>AAH 소식과 웹 서비스를 별도 보안 창에서 확인합니다.</p>
          <div className="site-preview">
            <span className="logo">A</span>
            <div><b>AAH 공식 사이트</b><small>https://aah.name</small></div>
          </div>
          <button onClick={openAahSite}>AAH 사이트 열기</button>
          <p className="muted">웹사이트 창은 지갑의 개인키·SEED·서명 기능에 접근할 수 없습니다. 사이트 창을 닫아도 지갑은 계속 실행됩니다.</p>
        </section>
      )}
      {showOnboarding && (
        <div className="modal-backdrop">
          <section className="modal card" role="dialog" aria-modal="true" aria-label="처음 사용 안내">
            <span className="eyebrow">처음 오셨군요</span>
            <h2>어렵지 않게 시작해 볼게요</h2>
            <ol className="steps">
              <li><b>내 이름 정하기</b><span>친구가 알아보기 쉬운 닉네임을 써요.</span></li>
              <li><b>주소 공유하기</b><span>주소 복사나 QR로 안전하게 AAH를 받아요.</span></li>
              <li><b>SEED 지키기</b><span>이메일로는 지갑을 복구할 수 없어요.</span></li>
            </ol>
            <form className="stack" onSubmit={storeProfile}>
              <input value={profile.nickname}
                onChange={(event) => setProfile({ ...profile, nickname: event.target.value })}
                placeholder="사용할 닉네임" maxLength={24} required autoFocus />
              <input type="email" value={profile.email}
                onChange={(event) => setProfile({ ...profile, email: event.target.value })}
                placeholder="이메일 (선택)" />
              <button>AAH Wallet 시작하기</button>
            </form>
          </section>
        </div>
      )}
      {pendingTransfer && (
        <div className="modal-backdrop">
          <section className="modal card" role="dialog" aria-modal="true" aria-label="송금 최종 확인">
            <span className="eyebrow">마지막 확인</span>
            <h2>{pendingTransfer.amount} AAH를 보낼까요?</h2>
            <dl><dt>받는 주소</dt><dd><code>{pendingTransfer.to}</code></dd><dt>예상 수수료</dt><dd>0.000000000000021 AAH</dd></dl>
            <p className="warning">블록체인 송금은 전송 후 취소할 수 없습니다.</p>
            <div className="actions"><button onClick={send} disabled={busy}>확인하고 보내기</button><button className="secondary" onClick={() => setPendingTransfer(null)} disabled={busy}>취소</button></div>
          </section>
        </div>
      )}
      {message && <div className="toast">{message}</div>}
    </main>
  );
}
