import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Wallet, formatEther } from "ethers";
import QRCode from "qrcode";
import { invoke } from "@tauri-apps/api/core";
import { decryptVault, encryptVault, type VaultPayload } from "./vault";
import {
  CHAIN_ID,
  EXPECTED_GENESIS_HASH,
  REQUIRED_PROTOCOL_VERSION,
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
  setGroupRole,
  type SocialBook
} from "./social";
import {
  createRoomSecret,
  decryptCommunication,
  pollEncryptedChat,
  sendEncryptedChat,
  sendEncryptedSignal,
  type CallSignal,
  type ChatMessage,
  type ChatScope
} from "./communication";
import { mediaConstraints, parseIceServers, stopMedia, type CallAuditEvent } from "./video";
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
import {
  loadTransferHistory,
  pageCount,
  saveTransfer,
  transferPage,
  type TransferHistoryItem
} from "./transferHistory";

type Screen = "home" | "create" | "restore";
type Tab = "wallet" | "exchange" | "reward" | "social" | "chat" | "site" | "profile";

interface NetworkStatus {
  nodeVersion: string;
  protocolVersion: string;
  peers: number;
  syncProgress: number;
  finalizedHeight: number;
  recoveryActive: boolean;
  readyForTransactions: boolean;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [vault, setVault] = useState<VaultPayload | null>(null);
  const [hasVault, setHasVault] = useState(false);
  const [password, setPassword] = useState("");
  const [rpcUrl, setRpcUrl] = useState("http://127.0.0.1:8989");
  const [balance, setBalance] = useState<bigint>(0n);
  const [networkOk, setNetworkOk] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus | null>(null);
  const [seed, setSeed] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [backupConfirmed, setBackupConfirmed] = useState(false);
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState("");
  const [transferHistory, setTransferHistory] = useState<TransferHistoryItem[]>([]);
  const [transferPageNumber, setTransferPageNumber] = useState(1);
  const [showNetworkSettings, setShowNetworkSettings] = useState(false);
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
  const [friendPeerId, setFriendPeerId] = useState("");
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
  const [chatScope, setChatScope] = useState<ChatScope>("direct");
  const [chatTargetId, setChatTargetId] = useState("");
  const [chatSecret, setChatSecret] = useState("");
  const [chatText, setChatText] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [iceServersJson, setIceServersJson] = useState(
    localStorage.getItem("ieum-ice-servers") ?? '[{"urls":"stun:stun.ieum.aah.name:3478"}]'
  );
  const [callState, setCallState] = useState<"idle" | "calling" | "connected">("idle");
  const [incomingCall, setIncomingCall] = useState<CallSignal | null>(null);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [autoLockMinutes, setAutoLockMinutes] = useState(
    Number(localStorage.getItem("ieum-auto-lock-minutes") ?? "5")
  );
  const [auditEntries, setAuditEntries] = useState<CallAuditEvent[]>([]);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callIdRef = useRef("");
  const callRoomRef = useRef("");
  const callRecipientsRef = useRef<ReturnType<typeof groupRecipients>>([]);

  const wallet = useMemo(() => (vault ? new Wallet(vault.privateKey) : null), [vault]);

  useEffect(() => {
    invoke<boolean>("vault_exists").then(setHasVault).catch(() => setHasVault(false));
    const savedRpc = localStorage.getItem("aah-rpc-url");
    if (savedRpc) setRpcUrl(savedRpc);
  }, []);

  useEffect(() => {
    if (vault) {
      QRCode.toDataURL(vault.address, { width: 220, margin: 1 }).then(setQr);
      loadSocialBook(vault.address, vault.privateKey)
        .then(setSocialBook)
        .catch(() => {
          setSocialBook(EMPTY_SOCIAL_BOOK);
          setMessage("암호화 주소록을 열지 못했습니다. 지갑을 다시 잠갔다가 열어 주세요.");
        });
      const last = localStorage.getItem(`aah-reward-${vault.address.toLowerCase()}`) ?? undefined;
      setRewardStatus(createDevelopmentRewardStatus(last));
      const savedProfile = loadProfile(vault.address);
      setProfile(savedProfile);
      setShowOnboarding(!savedProfile.onboardingDone);
      setTransferHistory(loadTransferHistory(vault.address));
      setTransferPageNumber(1);
    }
  }, [vault]);

  useEffect(() => {
    if (!vault) return;
    let timer = 0;
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(lock, autoLockMinutes * 60_000);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") lock();
      else reset();
    };
    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "touchstart"];
    events.forEach((event) => window.addEventListener(event, reset, { passive: true }));
    document.addEventListener("visibilitychange", onVisibility);
    reset();
    return () => {
      window.clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, reset));
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [autoLockMinutes, vault]);

  useEffect(() => {
    if (!deposit?.depositAddress) {
      setDepositQr("");
      return;
    }
    QRCode.toDataURL(deposit.depositAddress, { width: 220, margin: 1 }).then(setDepositQr);
  }, [deposit]);

  useEffect(() => {
    if (!vault || !chatSecret || tab !== "chat") return;
    let stopped = false;
    const poll = async () => {
      try {
        const envelopes = await pollEncryptedChat(rpcUrl);
        for (const envelope of envelopes) {
          try {
            const received = await decryptCommunication(envelope.encrypted_payload_hex, chatSecret);
            if (received.packetType === "call_signal") {
              await handleCallSignal(received);
              continue;
            }
            if (!stopped) {
              setChatMessages((current) =>
                current.some((item) => item.id === received.id) ? current : [...current, received]
              );
            }
          } catch {
            // 다른 방의 암호문은 현재 방 키로 열리지 않으므로 조용히 건너뜁니다.
          }
        }
      } catch {
        // 노드가 아직 실행되지 않은 동안에도 지갑의 다른 기능은 계속 사용합니다.
      }
    };
    void poll();
    const timer = window.setInterval(poll, 2000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [chatSecret, rpcUrl, tab, vault]);

  async function auditCall(event: CallAuditEvent) {
    try {
      await invoke("write_call_audit", { event });
    } catch {
      // 감사 파일 실패가 미디어 보호나 통화 종료를 방해하지 않게 합니다.
    }
  }

  function selectedCallContext() {
    if (!vault || chatScope !== "direct") throw new Error("화상통화는 현재 1:1 친구 통화만 지원합니다.");
    const recipients = socialBook.friends.filter((friend) => friend.id === chatTargetId);
    if (recipients.length !== 1) throw new Error("통화할 친구를 선택해 주세요.");
    if (chatSecret.length !== 64) throw new Error("확인된 64자리 채팅방 보안 키가 필요합니다.");
    return {
      recipients,
      roomId: [vault.address.toLowerCase(), recipients[0].address.toLowerCase()].sort().join(":")
    };
  }

  async function createPeer(callId: string, roomId: string, recipients: ReturnType<typeof groupRecipients>) {
    const peer = new RTCPeerConnection({ iceServers: parseIceServers(iceServersJson) });
    peerRef.current = peer;
    callIdRef.current = callId;
    callRoomRef.current = roomId;
    callRecipientsRef.current = recipients;
    peer.ontrack = (event) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
    };
    peer.onicecandidate = (event) => {
      if (!event.candidate) return;
      void sendEncryptedSignal(rpcUrl, recipients, {
        packetType: "call_signal",
        id: crypto.randomUUID(),
        roomId,
        senderAddress: vault?.address ?? "",
        callId,
        signalType: "ice",
        candidate: event.candidate.toJSON(),
        sentAt: new Date().toISOString()
      }, chatSecret);
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "connected") {
        setCallState("connected");
        void auditCall({ event: "connected", callId, roomId, occurredAt: new Date().toISOString() });
      }
      if (peer.connectionState === "failed") void finishCall("call_failed", false);
    };
    return peer;
  }

  async function requestMedia(callId: string, roomId: string) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints(cameraEnabled));
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      await auditCall({ event: "permission_granted", callId, roomId, occurredAt: new Date().toISOString() });
      return stream;
    } catch (error) {
      await auditCall({ event: "permission_denied", callId, roomId, occurredAt: new Date().toISOString(), detail: String(error).slice(0, 160) });
      throw new Error("카메라·마이크 권한이 필요합니다. 운영체제와 앱 권한 설정을 확인해 주세요.");
    }
  }

  async function startCall() {
    try {
      const { recipients, roomId } = selectedCallContext();
      localStorage.setItem("ieum-ice-servers", iceServersJson);
      const callId = crypto.randomUUID();
      const stream = await requestMedia(callId, roomId);
      const peer = await createPeer(callId, roomId, recipients);
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      await peer.setLocalDescription(await peer.createOffer());
      await sendEncryptedSignal(rpcUrl, recipients, {
        packetType: "call_signal", id: crypto.randomUUID(), roomId,
        senderAddress: vault?.address ?? "", callId, signalType: "offer",
        description: peer.localDescription ?? undefined, sentAt: new Date().toISOString()
      }, chatSecret);
      setCallState("calling");
      await auditCall({ event: "call_started", callId, roomId, occurredAt: new Date().toISOString() });
    } catch (error) {
      setMessage(String(error));
      await finishCall("call_failed", false);
    }
  }

  async function handleCallSignal(signal: CallSignal) {
    if (!vault || signal.senderAddress.toLowerCase() === vault.address.toLowerCase()) return;
    if (signal.signalType === "hangup") {
      await finishCall("call_ended", false);
      return;
    }
    const { recipients, roomId } = selectedCallContext();
    if (signal.roomId !== roomId) return;
    let peer = peerRef.current;
    if (signal.signalType === "offer") {
      if (callState === "idle") setIncomingCall(signal);
    } else if (signal.signalType === "answer" && peer && signal.description) {
      await peer.setRemoteDescription(signal.description);
    } else if (signal.signalType === "ice" && peer && signal.candidate) {
      await peer.addIceCandidate(signal.candidate);
    }
  }

  async function acceptCall() {
    if (!incomingCall || !vault) return;
    try {
      const signal = incomingCall;
      const { recipients, roomId } = selectedCallContext();
      const stream = await requestMedia(signal.callId, roomId);
      const peer = await createPeer(signal.callId, roomId, recipients);
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      await peer.setRemoteDescription(signal.description!);
      await peer.setLocalDescription(await peer.createAnswer());
      await sendEncryptedSignal(rpcUrl, recipients, {
        packetType: "call_signal", id: crypto.randomUUID(), roomId,
        senderAddress: vault.address, callId: signal.callId, signalType: "answer",
        description: peer.localDescription ?? undefined, sentAt: new Date().toISOString()
      }, chatSecret);
      setIncomingCall(null);
      setCallState("calling");
      await auditCall({ event: "call_started", callId: signal.callId, roomId, occurredAt: new Date().toISOString() });
    } catch (error) {
      setMessage(String(error));
      setIncomingCall(null);
      await finishCall("call_failed", false);
    }
  }

  async function finishCall(event: CallAuditEvent["event"] = "call_ended", notify = true) {
    const callId = callIdRef.current;
    const roomId = callRoomRef.current;
    if (notify && callId && callRecipientsRef.current.length) {
      await sendEncryptedSignal(rpcUrl, callRecipientsRef.current, {
        packetType: "call_signal", id: crypto.randomUUID(), roomId,
        senderAddress: vault?.address ?? "", callId, signalType: "hangup",
        sentAt: new Date().toISOString()
      }, chatSecret).catch(() => undefined);
    }
    if (peerRef.current) {
      peerRef.current.onconnectionstatechange = null;
      peerRef.current.close();
    }
    peerRef.current = null;
    stopMedia(localStreamRef.current);
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    setCallState("idle");
    setIncomingCall(null);
    if (callId && roomId) await auditCall({ event, callId, roomId, occurredAt: new Date().toISOString() });
    callIdRef.current = "";
  }

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
        throw new Error(`IEUM Chain ID(${CHAIN_ID})가 아닌 노드입니다.`);
      }
      const [identity, protocol, node, sync, finalized, recovery] = await Promise.all([
        rpcCall<{ chainId: number; genesisHash: string; protocolVersion: string }>(rpcUrl, "ieum_networkIdentity", []),
        rpcCall<{ nodeVersion: string; protocolVersion: string; minimumCompatibleProtocolVersion: string }>(rpcUrl, "ieum_protocolVersion", []),
        rpcCall<{ peers: number }>(rpcUrl, "ieum_nodeStatus", []),
        rpcCall<{ progressPercent: number; readyForTransactions: boolean }>(rpcUrl, "ieum_syncStatus", []),
        rpcCall<{ height: number }>(rpcUrl, "ieum_finalizedBlock", []),
        rpcCall<{ active: boolean }>(rpcUrl, "ieum_recoveryStatus", [])
      ]);
      if (identity.chainId !== CHAIN_ID || identity.genesisHash.toLowerCase() !== EXPECTED_GENESIS_HASH) {
        throw new Error("IEUM 운영망 제네시스와 일치하지 않는 노드입니다.");
      }
      if (
        Number(protocol.protocolVersion) < REQUIRED_PROTOCOL_VERSION ||
        REQUIRED_PROTOCOL_VERSION < Number(protocol.minimumCompatibleProtocolVersion)
      ) {
        throw new Error("노드 프로토콜 버전이 월렛과 호환되지 않습니다.");
      }
      if (!sync.readyForTransactions) {
        throw new Error(`노드 동기화 중입니다 (${sync.progressPercent.toFixed(1)}%). 송금은 동기화 후 가능합니다.`);
      }
      const value = await rpcCall<string>(rpcUrl, "eth_getBalance", [vault.address, "latest"]);
      setBalance(parseHexQuantity(value));
      setNetworkStatus({
        nodeVersion: protocol.nodeVersion,
        protocolVersion: identity.protocolVersion,
        peers: node.peers,
        syncProgress: sync.progressPercent,
        finalizedHeight: finalized.height,
        recoveryActive: recovery.active,
        readyForTransactions: sync.readyForTransactions
      });
      setNetworkOk(true);
      localStorage.setItem("aah-rpc-url", rpcUrl);
      setMessage("잔액을 새로 확인했습니다.");
    } catch (error) {
      setNetworkOk(false);
      setNetworkStatus(null);
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
      if (!networkOk || !networkStatus?.readyForTransactions || networkStatus.recoveryActive) {
        throw new Error("노드가 송금 가능한 정상 상태인지 먼저 새로고침으로 확인해 주세요.");
      }
      setBusy(true);
      const value = validateTransfer(to, amount);
      const nonceHex = await rpcCall<string>(rpcUrl, "eth_getTransactionCount", [
        vault.address,
        "pending"
      ]);
      // ieum-chain v0.6.3이 지원하는 EIP-155 legacy(type-0) 거래를 로컬 서명합니다.
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
      setTransferHistory(saveTransfer(vault.address, {
        hash,
        to,
        amount,
        sentAt: new Date().toISOString()
      }));
      setTransferPageNumber(1);
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
      setMessage("IEUM 사이트를 별도 보안 창으로 열었습니다.");
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
      setMessage("IEUM 교환 견적을 받았습니다. 만료 전에 내용을 확인해 주세요.");
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
      setMessage("USDT를 IEUM로 교환했습니다. 이제 내 지갑으로 받을 수 있습니다.");
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
      setMessage("내 IEUM 지갑으로 출금을 요청했습니다.");
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

  async function updateSocial(next: SocialBook) {
    if (!vault) return;
    setSocialBook(next);
    await saveSocialBook(vault.address, next, vault.privateKey);
  }

  async function submitFriend(event: FormEvent) {
    event.preventDefault();
    try {
      await updateSocial(addFriend(socialBook, friendName, friendAddress, friendPeerId));
      setFriendName("");
      setFriendAddress("");
      setFriendPeerId("");
      setMessage("친구를 주소록에 저장했습니다.");
    } catch (error) {
      setMessage(String(error));
    }
  }

  async function sendChat(event: FormEvent) {
    event.preventDefault();
    if (!vault) return;
    try {
      const recipients = chatScope === "direct"
        ? socialBook.friends.filter((friend) => friend.id === chatTargetId)
        : groupRecipients(socialBook, chatTargetId);
      if (recipients.length === 0) throw new Error("대화 상대 또는 채팅방을 선택해 주세요.");
      const roomId = chatScope === "direct"
        ? [vault.address.toLowerCase(), recipients[0].address.toLowerCase()].sort().join(":")
        : chatTargetId;
      const outgoing: ChatMessage = {
        id: crypto.randomUUID(),
        scope: chatScope,
        roomId,
        senderAddress: vault.address,
        senderName: profile.nickname || "IEUM 사용자",
        text: chatText.trim(),
        sentAt: new Date().toISOString()
      };
      const count = await sendEncryptedChat(rpcUrl, recipients, outgoing, chatSecret);
      setChatMessages((current) => [...current, outgoing]);
      setChatText("");
      setMessage(`${count}명에게 암호화 메시지를 보냈습니다.`);
    } catch (error) {
      setMessage(String(error));
    }
  }

  function newChatSecret() {
    setChatSecret(createRoomSecret());
    setChatMessages([]);
    setMessage("새 채팅방 보안 키를 만들었습니다. 상대에게 안전한 별도 경로로 전달하세요.");
  }

  function openFriendChat(friendId: string) {
    setChatScope("direct");
    setChatTargetId(friendId);
    setChatMessages([]);
    setTab("chat");
  }

  function openGroupChat(selectedGroupId: string) {
    setChatScope("group");
    setChatTargetId(selectedGroupId);
    setChatMessages([]);
    setTab("chat");
  }

  function openRandomFriendChat() {
    if (socialBook.friends.length === 0) {
      setMessage("랜덤 대화를 시작하려면 친구를 먼저 한 명 이상 추가해 주세요.");
      setTab("social");
      return;
    }
    const index = crypto.getRandomValues(new Uint32Array(1))[0] % socialBook.friends.length;
    const friend = socialBook.friends[index];
    openFriendChat(friend.id);
    setMessage(`${friend.name}님과 랜덤 대화를 시작합니다.`);
  }

  async function submitGroup(event: FormEvent) {
    event.preventDefault();
    try {
      const next = createGroup(socialBook, groupName, selectedFriendIds);
      await updateSocial(next);
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
    setMessage("개발 모드 광고 완료를 기록했습니다. 실제 IEUM 지급은 보상 서버 연동 후 활성화됩니다.");
  }

  function lock() {
    void finishCall("call_ended", true);
    setVault(null);
    setBalance(0n);
    setSocialBook(EMPTY_SOCIAL_BOOK);
    setProfile(EMPTY_PROFILE);
    setChatSecret("");
    setChatMessages([]);
    setTransferHistory([]);
    setAuditEntries([]);
    setPassword("");
    setMessage("지갑을 잠갔습니다.");
  }

  function changeAutoLock(minutes: number) {
    setAutoLockMinutes(minutes);
    localStorage.setItem("ieum-auto-lock-minutes", String(minutes));
    setMessage(`자동 잠금을 ${minutes}분으로 설정했습니다.`);
  }

  async function loadAuditEntries() {
    try {
      const entries = await invoke<CallAuditEvent[]>("read_call_audit");
      setAuditEntries(entries);
      setMessage(`최근 통화 감사 기록 ${entries.length}건을 불러왔습니다.`);
    } catch (error) {
      setMessage(String(error));
    }
  }

  async function clearAuditEntries() {
    try {
      await invoke("clear_call_audit");
      setAuditEntries([]);
      setMessage("이 기기의 통화 감사 기록을 삭제했습니다.");
    } catch (error) {
      setMessage(String(error));
    }
  }

  if (!vault) {
    return (
      <main className="shell narrow">
        <header><span className="logo">A</span><div><h1>IEUM Wallet</h1><p>가볍고 안전한 IEUM 지갑</p></div></header>
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
      <header><span className="logo">A</span><div><h1>{profile.nickname || "IEUM Wallet"}</h1><p className={networkOk ? "online" : ""}>● {networkOk ? "IEUM 네트워크 연결됨" : "연결 확인 필요"}</p></div>{!networkOk && <button className="secondary small" onClick={() => setShowNetworkSettings(true)}>연결 문제</button>}<button className="secondary small" onClick={lock}>잠금</button></header>
      <nav className="tabs" aria-label="주요 기능">
        <button className={tab === "wallet" ? "active" : ""} onClick={() => setTab("wallet")}>지갑</button>
        <button className={tab === "exchange" ? "active" : ""} onClick={() => setTab("exchange")}>USDT 교환</button>
        <button className={tab === "reward" ? "active" : ""} onClick={() => setTab("reward")}>광고 보상</button>
        <button className={tab === "social" ? "active" : ""} onClick={() => setTab("social")}>친구·그룹</button>
        <button className={tab === "chat" ? "active" : ""} onClick={() => setTab("chat")}>채팅</button>
        <button className={tab === "site" ? "active" : ""} onClick={() => setTab("site")}>IEUM 사이트</button>
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
          <h2>IEUM 보내기</h2>
          <form onSubmit={requestSend} className="stack">
            <label>받는 주소<input value={to} onChange={(e) => setTo(e.target.value)} placeholder="0x..." required /></label>
            <label>수량<input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.0" required /></label>
            <p className="muted">기본 수수료: gas 21,000 × gasPrice 1 · IEUM Chain ID 21004</p>
            <button disabled={busy}>확인 후 전송</button>
          </form>
        </section>
        <section className="card network-summary">
          <h2>네트워크</h2>
          <p className={networkOk ? "online" : "warning"}>{networkOk ? "정상 연결됨" : "연결을 확인해 주세요"}</p>
          {networkStatus && <dl className="network-status">
            <dt>노드</dt><dd>v{networkStatus.nodeVersion} · 프로토콜 {networkStatus.protocolVersion}</dd>
            <dt>피어</dt><dd>{networkStatus.peers}개</dd>
            <dt>동기화</dt><dd>{networkStatus.syncProgress.toFixed(1)}%</dd>
            <dt>최종 확정 블록</dt><dd>{networkStatus.finalizedHeight.toLocaleString()}</dd>
            <dt>복구 상태</dt><dd className={networkStatus.recoveryActive ? "warning" : "online"}>{networkStatus.recoveryActive ? "복구안 처리 중" : "정상"}</dd>
          </dl>}
          <button className="secondary" onClick={() => setShowNetworkSettings((value) => !value)}>
            {showNetworkSettings ? "설정 닫기" : "문제 해결·고급 설정"}
          </button>
          {showNetworkSettings && <div className="network-details">
            <label>IEUM 노드 RPC<input value={rpcUrl} onChange={(e) => setRpcUrl(e.target.value)} /></label>
            <button className="secondary" onClick={refresh}>연결 다시 확인</button>
            <dl><dt>Chain ID</dt><dd>{CHAIN_ID}</dd><dt>기본 RPC</dt><dd>127.0.0.1:8989</dd></dl>
          </div>}
        </section>
      </div>
      <section className="card">
        <h2>최근 전송</h2>
        {transferHistory.length > 0 ? <>
          <ul className="transfer-list">
            {transferPage(transferHistory, transferPageNumber).map((item) => <li key={item.hash}>
              <b>{item.amount} IEUM</b><span>받는 주소 {item.to}</span>
              <code>{item.hash}</code><small>{new Date(item.sentAt).toLocaleString()}</small>
            </li>)}
          </ul>
          <div className="pagination">
            <button className="secondary" disabled={transferPageNumber <= 1}
              onClick={() => setTransferPageNumber((page) => page - 1)}>이전</button>
            <span>{transferPageNumber} / {pageCount(transferHistory.length)}</span>
            <button className="secondary" disabled={transferPageNumber >= pageCount(transferHistory.length)}
              onClick={() => setTransferPageNumber((page) => page + 1)}>다음</button>
          </div>
        </> : txHash ? <p><code>{txHash}</code></p>
          : <p className="muted">최근 전송 내역이 없습니다.</p>}
      </section>
      </>}
      {tab === "exchange" && (
        <section className="exchange-layout">
          <div className="card exchange-hero">
            <span className="eyebrow">IEUM SIMPLE SWAP · v0.0.4.3</span>
            <h2>USDT로 IEUM 받기</h2>
            <p>입금 네트워크를 고르고, 입금이 확인되면 IEUM로 교환한 뒤 현재 지갑으로 받습니다.</p>
            <ol className="swap-steps">
              <li className={deposit ? "done" : "active"}><b>1</b><span>USDT 입금</span></li>
              <li className={swapProgress?.status === "SWAPPED" || swapProgress?.status === "COMPLETED" ? "done" : deposit ? "active" : ""}><b>2</b><span>IEUM 교환</span></li>
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
              <h2>2. IEUM로 교환</h2>
              <label>확인된 USDT 수량
                <input value={usdtAmount} onChange={(event) => setUsdtAmount(event.target.value)}
                  inputMode="decimal" placeholder="예: 100" />
              </label>
              <button onClick={quoteSwap} disabled={busy || !deposit}>교환 견적 보기</button>
              {swapQuote && <div className="quote-box">
                <dl>
                  <dt>교환 전</dt><dd>{swapQuote.grossAah} IEUM</dd>
                  <dt>재단 수수료</dt><dd>{swapQuote.foundationFeeAah} IEUM</dd>
                  <dt>출금 비용</dt><dd>{swapQuote.networkFeeAah} IEUM</dd>
                  <dt>최소 수령</dt><dd><strong>{swapQuote.minimumReceivedAah} IEUM</strong></dd>
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
                IEUM 받기
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
          <p className="warning">실제 광고 재생·부정 참여 검증·IEUM 지급은 보상 서버 URL과 서명 규격 확정 후 활성화됩니다.</p>
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
              <input value={friendPeerId} onChange={(event) => setFriendPeerId(event.target.value)}
                placeholder="12D3KooW... 통신 PeerId" required />
              <button>주소록에 저장</button>
            </form>
            <button type="button" className="secondary random-chat" onClick={openRandomFriendChat}>친구 중 랜덤 대화</button>
            <ul className="people">
              {socialBook.friends.map((friend) => (
                <li key={friend.id}><b>{friend.name}</b><code>{friend.address}</code><small>{friend.peerId || "PeerId 재등록 필요"}</small>
                  <button type="button" className="secondary small-action" onClick={() => openFriendChat(friend.id)}>채팅 열기</button>
                </li>
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
                <li key={group.id}>
                  <b>{group.name}</b><code>{group.inviteCode}</code>
                  <button type="button" className="secondary small-action" onClick={() => openGroupChat(group.id)}>그룹 채팅 열기</button>
                  {group.members.map((member) => {
                    const friend = socialBook.friends.find((item) => item.id === member.friendId);
                    return <label key={member.friendId}>{friend?.name ?? "알 수 없음"}
                      <select value={member.role} onChange={(event) =>
                        updateSocial(setGroupRole(socialBook, group.id, member.friendId, event.target.value as "moderator" | "audience"))
                      }>
                        <option value="audience">청중</option>
                        <option value="moderator">부방장</option>
                      </select>
                    </label>;
                  })}
                </li>
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
                inputMode="decimal" placeholder="1명당 보낼 IEUM" required />
              <button disabled={busy}>구성원별 순차 전송</button>
            </form>
            <p className="warning">다중 송금 컨트랙트가 없어 일부 거래만 성공할 수 있습니다. 테스트넷에서 소액으로 확인하세요.</p>
          </section>
        </div>
      )}
      {tab === "chat" && (
        <section className="chat-layout">
          <div className="card chat-settings">
            <span className="eyebrow">IEUM CHAIN v0.21.0</span>
            <h2>종단간 암호화 채팅</h2>
            <button type="button" className="secondary random-chat" onClick={openRandomFriendChat}>친구 중 랜덤 대화</button>
            <div className="chat-kind">
              <button type="button" className={chatScope === "direct" ? "" : "secondary"}
                onClick={() => { setChatScope("direct"); setChatTargetId(""); }}>1:1</button>
              <button type="button" className={chatScope === "group" ? "" : "secondary"}
                onClick={() => { setChatScope("group"); setChatTargetId(""); }}>1:n 방</button>
            </div>
            <select value={chatTargetId} onChange={(event) => setChatTargetId(event.target.value)}>
              <option value="">{chatScope === "direct" ? "친구 선택" : "채팅방 선택"}</option>
              {(chatScope === "direct" ? socialBook.friends : socialBook.groups).map((item) =>
                <option key={item.id} value={item.id}>{item.name}</option>
              )}
            </select>
            <label>채팅방 보안 키
              <input type="password" value={chatSecret} onChange={(event) => setChatSecret(event.target.value.trim())}
                placeholder="상대와 확인한 64자리 키" />
            </label>
            <button type="button" className="secondary" onClick={newChatSecret}>새 보안 키 만들기</button>
            <p className="warning">보안 키는 채팅으로 보내지 말고 직접 만나거나 확인된 별도 경로로 공유하세요. 메시지는 원장에 저장되지 않으며 앱을 닫으면 대화 화면에서 사라집니다.</p>
          </div>
          <div className="card chat-panel">
            <div className="chat-messages" aria-live="polite">
              {chatMessages.length === 0 && <p className="muted">아직 표시할 메시지가 없습니다.</p>}
              {chatMessages.map((item) => (
                <article key={item.id} className={item.senderAddress === vault.address ? "mine" : ""}>
                  <b>{item.senderName}</b><p>{item.text}</p>
                  <small>{new Date(item.sentAt).toLocaleTimeString()}</small>
                </article>
              ))}
            </div>
            <form className="chat-compose" onSubmit={sendChat}>
              <textarea value={chatText} onChange={(event) => setChatText(event.target.value)}
                maxLength={4000} placeholder="메시지 입력" required />
              <button disabled={busy || !chatTargetId || chatSecret.length !== 64}>암호화해 보내기</button>
            </form>
          </div>
          <div className="card call-panel">
            <div>
              <span className="eyebrow">WEBRTC · DTLS-SRTP</span>
              <h2>보안 화상통화</h2>
              <p className="muted">영상·음성은 상대 기기와 암호화 전송되며 녹화하거나 감사 로그에 저장하지 않습니다.</p>
            </div>
            <div className="call-videos">
              <video ref={remoteVideoRef} autoPlay playsInline aria-label="상대 영상" />
              <video ref={localVideoRef} autoPlay playsInline muted aria-label="내 영상" />
            </div>
            <label className="check">
              <input type="checkbox" checked={cameraEnabled}
                onChange={(event) => setCameraEnabled(event.target.checked)} disabled={callState !== "idle"} />
              카메라 사용 (끄면 마이크 통화)
            </label>
            <details>
              <summary>STUN/TURN 운영 설정</summary>
              <textarea value={iceServersJson} onChange={(event) => setIceServersJson(event.target.value)}
                disabled={callState !== "idle"} spellCheck={false} />
              <p className="muted">TURN 계정은 장기 고정 비밀번호 대신 서버에서 발급한 단기 자격증명을 사용하세요.</p>
            </details>
            <div className="call-actions">
              {incomingCall ? <>
                <button type="button" onClick={acceptCall}>통화 받기</button>
                <button type="button" className="secondary" onClick={() => setIncomingCall(null)}>거절</button>
              </> : callState === "idle"
                ? <button type="button" onClick={startCall} disabled={chatScope !== "direct" || !chatTargetId}>통화 시작</button>
                : <button type="button" className="danger" onClick={() => void finishCall()}>통화 종료</button>}
              <strong>{incomingCall ? "수신 통화" : callState === "idle" ? "대기" : callState === "calling" ? "연결 중" : "보안 연결됨"}</strong>
            </div>
          </div>
        </section>
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
          <hr />
          <h2>보안 및 감사</h2>
          <label>사용하지 않을 때 자동 잠금
            <select value={autoLockMinutes}
              onChange={(event) => changeAutoLock(Number(event.target.value))}>
              <option value={5}>5분</option>
              <option value={15}>15분</option>
              <option value={30}>30분</option>
            </select>
          </label>
          <p className="muted">앱이 백그라운드로 이동하면 선택한 시간과 관계없이 즉시 잠깁니다. 친구·그룹 주소록은 지갑 키로 암호화해 이 기기에 저장합니다.</p>
          <div className="actions">
            <button type="button" className="secondary" onClick={loadAuditEntries}>통화 감사 기록 보기</button>
            <button type="button" className="danger" onClick={clearAuditEntries}
              disabled={auditEntries.length === 0}>감사 기록 삭제</button>
          </div>
          {auditEntries.length > 0 && (
            <ul className="audit-list">
              {auditEntries.map((entry, index) => (
                <li key={`${entry.callId}-${entry.occurredAt}-${index}`}>
                  <b>{entry.event}</b>
                  <span>{new Date(entry.occurredAt).toLocaleString()}</span>
                  <small>통화 ID {entry.callId}</small>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {tab === "site" && (
        <section className="card site-card">
          <span className="eyebrow">IEUM OFFICIAL</span>
          <h2>aah.name</h2>
          <p>IEUM 소식과 웹 서비스를 별도 보안 창에서 확인합니다.</p>
          <div className="site-preview">
            <span className="logo">A</span>
            <div><b>IEUM 공식 사이트</b><small>https://aah.name</small></div>
          </div>
          <button onClick={openAahSite}>IEUM 사이트 열기</button>
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
              <li><b>주소 공유하기</b><span>주소 복사나 QR로 안전하게 IEUM를 받아요.</span></li>
              <li><b>SEED 지키기</b><span>이메일로는 지갑을 복구할 수 없어요.</span></li>
            </ol>
            <form className="stack" onSubmit={storeProfile}>
              <input value={profile.nickname}
                onChange={(event) => setProfile({ ...profile, nickname: event.target.value })}
                placeholder="사용할 닉네임" maxLength={24} required autoFocus />
              <input type="email" value={profile.email}
                onChange={(event) => setProfile({ ...profile, email: event.target.value })}
                placeholder="이메일 (선택)" />
              <button>IEUM Wallet 시작하기</button>
            </form>
          </section>
        </div>
      )}
      {pendingTransfer && (
        <div className="modal-backdrop">
          <section className="modal card" role="dialog" aria-modal="true" aria-label="송금 최종 확인">
            <span className="eyebrow">마지막 확인</span>
            <h2>{pendingTransfer.amount} IEUM를 보낼까요?</h2>
            <dl><dt>받는 주소</dt><dd><code>{pendingTransfer.to}</code></dd><dt>예상 수수료</dt><dd>0.000000000000021 IEUM</dd></dl>
            <p className="warning">블록체인 송금은 전송 후 취소할 수 없습니다.</p>
            <div className="actions"><button onClick={send} disabled={busy}>확인하고 보내기</button><button className="secondary" onClick={() => setPendingTransfer(null)} disabled={busy}>취소</button></div>
          </section>
        </div>
      )}
      {message && <div className="toast">{message}</div>}
    </main>
  );
}
