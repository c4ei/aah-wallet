import { getAddress, isAddress } from "ethers";
import { decryptLocalData, encryptLocalData } from "./vault";

export interface Friend {
  id: string;
  name: string;
  address: string;
  peerId: string;
  createdAt: string;
}

export type GroupRole = "owner" | "moderator" | "audience";

export interface GroupMember {
  friendId: string;
  role: GroupRole;
}

export interface Group {
  id: string;
  name: string;
  members: GroupMember[];
  inviteCode: string;
  chatEnabledForAudience: boolean;
  createdAt: string;
}

export interface SocialBook {
  version: 2;
  friends: Friend[];
  groups: Group[];
}

export const EMPTY_SOCIAL_BOOK: SocialBook = { version: 2, friends: [], groups: [] };

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function validatePeerId(peerId: string): string {
  const normalized = peerId.trim();
  if (!/^12D3KooW[1-9A-HJ-NP-Za-km-z]{20,100}$/.test(normalized)) {
    throw new Error("친구의 IEUM PeerId가 올바르지 않습니다.");
  }
  return normalized;
}

export function addFriend(
  book: SocialBook,
  name: string,
  address: string,
  peerId: string
): SocialBook {
  const normalizedName = name.trim();
  if (!normalizedName) throw new Error("친구 이름을 입력해 주세요.");
  if (!isAddress(address)) throw new Error("친구 지갑 주소가 올바르지 않습니다.");
  const checksumAddress = getAddress(address);
  if (book.friends.some((friend) => friend.address.toLowerCase() === checksumAddress.toLowerCase())) {
    throw new Error("이미 등록된 지갑 주소입니다.");
  }
  const normalizedPeerId = validatePeerId(peerId);
  if (book.friends.some((friend) => friend.peerId === normalizedPeerId)) {
    throw new Error("이미 등록된 PeerId입니다.");
  }
  return {
    ...book,
    friends: [
      ...book.friends,
      {
        id: crypto.randomUUID(),
        name: normalizedName,
        address: checksumAddress,
        peerId: normalizedPeerId,
        createdAt: new Date().toISOString()
      }
    ]
  };
}

export function createGroup(book: SocialBook, name: string, memberIds: string[]): SocialBook {
  const normalizedName = name.trim();
  if (!normalizedName) throw new Error("그룹 이름을 입력해 주세요.");
  const uniqueIds = [...new Set(memberIds)];
  if (uniqueIds.length === 0) throw new Error("그룹에 친구를 한 명 이상 선택해 주세요.");
  if (uniqueIds.some((id) => !book.friends.some((friend) => friend.id === id))) {
    throw new Error("존재하지 않는 친구가 포함돼 있습니다.");
  }
  return {
    ...book,
    groups: [
      ...book.groups,
      {
        id: crypto.randomUUID(),
        name: normalizedName,
        members: uniqueIds.map((friendId) => ({ friendId, role: "audience" })),
        inviteCode: `IEUM-${randomCode()}`,
        chatEnabledForAudience: true,
        createdAt: new Date().toISOString()
      }
    ]
  };
}

export function groupRecipients(book: SocialBook, groupId: string): Friend[] {
  const group = book.groups.find((item) => item.id === groupId);
  if (!group) throw new Error("그룹을 찾지 못했습니다.");
  return group.members
    .map((member) => book.friends.find((friend) => friend.id === member.friendId))
    .filter((friend): friend is Friend => Boolean(friend));
}

export function setGroupRole(
  book: SocialBook,
  groupId: string,
  friendId: string,
  role: Exclude<GroupRole, "owner">
): SocialBook {
  const group = book.groups.find((item) => item.id === groupId);
  if (!group) throw new Error("그룹을 찾지 못했습니다.");
  if (!group.members.some((member) => member.friendId === friendId)) {
    throw new Error("그룹 구성원이 아닙니다.");
  }
  return {
    ...book,
    groups: book.groups.map((item) =>
      item.id === groupId
        ? {
            ...item,
            members: item.members.map((member) =>
              member.friendId === friendId ? { ...member, role } : member
            )
          }
        : item
    )
  };
}

export function parseInviteCode(code: string): string {
  const normalized = code.trim().toUpperCase();
  if (!/^IEUM-[0-9A-F]{12}$/.test(normalized)) {
    throw new Error("초대 코드 형식이 올바르지 않습니다.");
  }
  return normalized;
}

export async function loadSocialBook(address: string, secret: string): Promise<SocialBook> {
  const storageKey = `aah-social-${address.toLowerCase()}`;
  const raw = localStorage.getItem(storageKey);
  if (!raw) return EMPTY_SOCIAL_BOOK;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const value = ("ciphertext" in parsed
      ? await decryptLocalData<SocialBook>(raw, secret)
      : parsed) as SocialBook | {
      version: 1;
      friends: Array<Omit<Friend, "peerId">>;
      groups: Array<Omit<Group, "members" | "chatEnabledForAudience"> & { memberIds: string[] }>;
    };
    if (value.version === 2) {
      if (!("ciphertext" in parsed)) await saveSocialBook(address, value, secret);
      return value;
    }
    if (value.version === 1) {
      const migrated: SocialBook = {
        version: 2,
        friends: value.friends.map((friend) => ({ ...friend, peerId: "" })),
        groups: value.groups.map((group) => ({
          id: group.id,
          name: group.name,
          inviteCode: group.inviteCode,
          createdAt: group.createdAt,
          chatEnabledForAudience: true,
          members: group.memberIds.map((friendId) => ({ friendId, role: "audience" }))
        }))
      };
      await saveSocialBook(address, migrated, secret);
      return migrated;
    }
    return EMPTY_SOCIAL_BOOK;
  } catch {
    return EMPTY_SOCIAL_BOOK;
  }
}

export async function saveSocialBook(
  address: string,
  book: SocialBook,
  secret: string
): Promise<void> {
  const encrypted = await encryptLocalData(book, secret);
  localStorage.setItem(`aah-social-${address.toLowerCase()}`, encrypted);
}
