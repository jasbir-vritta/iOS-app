import { create } from "zustand";
import { API_URL, authHeaders } from "../../lib/auth";

type User = {
  name: string;
  placeOfBirth: string;
  dateOfBirth: string;
  timeOfBirth: string;
  gender: string;
  language: string;
  lat: string;
  lon: string;
  tzone: string;
  active_profile_id: string | null;
  credits?: number;
  // True until the user has chatted with any astrologer.
  free_chat_minute_available?: boolean;
};

type UserStore = {
  user: User;
  updateUser: (data: Partial<User>) => void;
  clearUser: () => void;
};

const initialUser: User = {
  name: "",
  placeOfBirth: "",
  dateOfBirth: "",
  timeOfBirth: "",
  gender: "",
  language: "",
  lat: "",
  lon: "",
  tzone: "",
  active_profile_id: null,
};

export const useUserStore = create<UserStore>((set) => ({
  user: initialUser,

  updateUser: (data) =>
    set((state) => ({
      user: {
        ...state.user,
        ...data,
      },
    })),

  clearUser: () =>
    set({
      user: initialUser,
    }),
}));

/**
 * Chat sockets send `{ type: "wallet_update", credits }` after each
 * 30-second charge. Returns true if the payload was one of those.
 */
export function applyWalletUpdate(payload: any): boolean {
  if (payload?.type !== "wallet_update") return false;

  const credits = Number(payload.credits);

  if (Number.isFinite(credits)) {
    useUserStore.getState().updateUser({ credits });
  }

  return true;
}

/** Reloads the wallet balance, e.g. after a chat's final charge. */
export async function refreshWalletCredits(): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/api/user/profiles`, {
      headers: await authHeaders(),
    });

    if (!response.ok) return;

    const data = await response.json();
    const credits = Number(data?.credits);

    if (Number.isFinite(credits)) {
      useUserStore.getState().updateUser({ credits });
    }
  } catch {
    // Keep the last known balance.
  }
}