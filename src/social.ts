import { getAddress, isAddress } from "ethers";

export interface Friend {
  id: string;
  name: string;
  address: string;
  createdAt: string;
}

export interface Group {
  id: string;
  name: string;
  memberIds: string[];
  inviteCode: string;
  createdAt: string;
}

export interface SocialBook {
  version: 1;
  friends: Friend[];
  groups: Group[];
}

export const EMPTY_SOCIAL_BOOK: SocialBook = { version: 1, friends: [], groups: [] };

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

export function addFriend(book: SocialBook, name: string, address: string): SocialBook {
  const normalizedName = name.trim();
  if (!normalizedName) throw new Error("친구 이름을 입력해 주세요.");
  if (!isAddress(address)) throw new Error("친구 지갑 주소가 올바르지 않습니다.");
  const checksumAddress = getAddress(address);
  if (book.friends.some((friend) => friend.address.toLowerCase() === checksumAddress.toLowerCase())) {
    throw new Error("이미 등록된 지갑 주소입니다.");
  }
  return {
    ...book,
    friends: [
      ...book.friends,
      {
        id: crypto.randomUUID(),
        name: normalizedName,
        address: checksumAddress,
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
        memberIds: uniqueIds,
        inviteCode: `AAH-${randomCode()}`,
        createdAt: new Date().toISOString()
      }
    ]
  };
}

export function groupRecipients(book: SocialBook, groupId: string): Friend[] {
  const group = book.groups.find((item) => item.id === groupId);
  if (!group) throw new Error("그룹을 찾지 못했습니다.");
  return group.memberIds
    .map((id) => book.friends.find((friend) => friend.id === id))
    .filter((friend): friend is Friend => Boolean(friend));
}

export function parseInviteCode(code: string): string {
  const normalized = code.trim().toUpperCase();
  if (!/^AAH-[0-9A-F]{12}$/.test(normalized)) {
    throw new Error("초대 코드 형식이 올바르지 않습니다.");
  }
  return normalized;
}

export function loadSocialBook(address: string): SocialBook {
  const raw = localStorage.getItem(`aah-social-${address.toLowerCase()}`);
  if (!raw) return EMPTY_SOCIAL_BOOK;
  try {
    const value = JSON.parse(raw) as SocialBook;
    return value.version === 1 ? value : EMPTY_SOCIAL_BOOK;
  } catch {
    return EMPTY_SOCIAL_BOOK;
  }
}

export function saveSocialBook(address: string, book: SocialBook): void {
  localStorage.setItem(`aah-social-${address.toLowerCase()}`, JSON.stringify(book));
}
