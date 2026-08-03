import { beforeEach, describe, expect, it, vi } from "vitest";
import { addFriend, createGroup, EMPTY_SOCIAL_BOOK, groupRecipients, parseInviteCode, setGroupRole } from "./social";

const PEER_ID = "12D3KooW123456789ABCDEFGHJKLMNPQRSTUVWXYZ";

describe("친구와 그룹", () => {
  beforeEach(() => {
    vi.stubGlobal("crypto", {
      randomUUID: () => "test-id",
      getRandomValues: (bytes: Uint8Array) => bytes.fill(10)
    });
  });

  it("주소를 체크섬 형식으로 저장하고 중복을 막는다", () => {
    const first = addFriend(
      EMPTY_SOCIAL_BOOK,
      "친구",
      "0x0000000000000000000000000000000000000001",
      PEER_ID
    );
    expect(first.friends).toHaveLength(1);
    expect(() => addFriend(first, "중복", first.friends[0].address, `${PEER_ID}A`)).toThrow("이미 등록");
  });

  it("선택한 친구로 그룹과 초대 코드를 만든다", () => {
    const withFriend = addFriend(
      EMPTY_SOCIAL_BOOK,
      "친구",
      "0x0000000000000000000000000000000000000001",
      PEER_ID
    );
    const result = createGroup(withFriend, "우리 그룹", [withFriend.friends[0].id]);
    expect(groupRecipients(result, result.groups[0].id)).toHaveLength(1);
    expect(parseInviteCode(result.groups[0].inviteCode)).toBe(result.groups[0].inviteCode);
    const promoted = setGroupRole(result, result.groups[0].id, withFriend.friends[0].id, "moderator");
    expect(promoted.groups[0].members[0].role).toBe("moderator");
  });
});
