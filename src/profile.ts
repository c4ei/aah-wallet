export type UserProfile = {
  nickname: string;
  email: string;
  onboardingDone: boolean;
};

export const EMPTY_PROFILE: UserProfile = {
  nickname: "",
  email: "",
  onboardingDone: false
};

function storageKey(address: string) {
  return `aah-profile-${address.toLowerCase()}`;
}

export function normalizeProfile(profile: UserProfile): UserProfile {
  const nickname = profile.nickname.trim().slice(0, 24);
  const email = profile.email.trim().toLowerCase().slice(0, 120);
  if (!nickname) throw new Error("닉네임을 입력해 주세요.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("이메일 형식을 확인해 주세요.");
  }
  return { ...profile, nickname, email };
}

export function loadProfile(address: string): UserProfile {
  try {
    const raw = localStorage.getItem(storageKey(address));
    return raw ? { ...EMPTY_PROFILE, ...JSON.parse(raw) } : EMPTY_PROFILE;
  } catch {
    return EMPTY_PROFILE;
  }
}

export function saveProfile(address: string, profile: UserProfile) {
  const normalized = normalizeProfile(profile);
  localStorage.setItem(storageKey(address), JSON.stringify(normalized));
  return normalized;
}
