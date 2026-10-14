
import { create } from "zustand";
import { API_URL, authHeaders } from "../../lib/auth";

export type LeaderboardPeriod = "daily" | "weekly" | "monthly";

export interface LeaderboardUser {
  rank: number;
  user_id: string;
  profile_id: string;
  name: string;
  avatar_url: string | null;
  chants: number;
  is_current_user: boolean;
}

interface ClaimMantraResponse {
  success: boolean;
  profile_id: string;
  total_chants: number;
  chants_added: number;
  chants_until_next_reward: number;
  rewards_awarded: number;
  credits_awarded: number;
  // Days in a row with a round of 108; null when no round was completed now.
  streak?: {
    current: number;
    days: number;
    target: number;
    bonus: number;
    completed_today: boolean;
  } | null;
  // Credits from the streak bonus given with this request (7, 14, 21… days).
  streak_bonus_awarded?: number;
  wallet: {
    credits: number;
  };
}

interface LeaderboardResponse {
  success: boolean;
  period: LeaderboardPeriod;
  starts_at: string;
  ends_at: string;
  leaderboard: LeaderboardUser[];
  my_rank: LeaderboardUser | null;
}

interface MantraStore {
  totalChants: number;
  chantsUntilNextReward: number;
  walletCredits: number;
  rewardsAwarded: number;
  creditsAwarded: number;

  leaderboard: LeaderboardUser[];
  myRank: LeaderboardUser | null;
  leaderboardPeriod: LeaderboardPeriod;

  claiming: boolean;
  leaderboardLoading: boolean;
  error: string | null;

  claimMantra: (
    profileId: string,
    mantraChants?: number
  ) => Promise<ClaimMantraResponse>;

  fetchLeaderboard: (
    period?: LeaderboardPeriod
  ) => Promise<void>;

  clearMantraStore: () => void;
}

const initialState = {
  totalChants: 0,
  chantsUntilNextReward: 108,
  walletCredits: 0,
  rewardsAwarded: 0,
  creditsAwarded: 0,

  leaderboard: [] as LeaderboardUser[],
  myRank: null as LeaderboardUser | null,
  leaderboardPeriod: "daily" as LeaderboardPeriod,

  claiming: false,
  leaderboardLoading: false,
  error: null as string | null,
};

async function parseApiResponse<T>(
  response: Response
): Promise<T> {
  const responseText = await response.text();

  console.log("API STATUS:", response.status);
  console.log("API RESPONSE:", responseText);

  let data: any;

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      `Backend returned a non-JSON response (HTTP ${response.status}): ${responseText.slice(0, 300) || "Empty response"}`
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.detail ||
        data?.message ||
        `API request failed with status ${response.status}`
    );
  }

  return data as T;
}

export const useMantraStore = create<MantraStore>((set) => ({
  ...initialState,

  claimMantra: async (profileId, mantraChants = 1) => {
    try {
      set({
        claiming: true,
        error: null,
      });

      const response = await fetch(`${API_URL}/mantra/claim`, {
        method: "POST",
        headers: {
          ...(await authHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profile_id: profileId,
          mantra_chants: mantraChants,
        }),
      });

      const data = await parseApiResponse<ClaimMantraResponse>(
        response
      );

      if (!data.wallet || typeof data.wallet.credits !== "number") {
        throw new Error(
          "Invalid claim response: wallet credits are missing."
        );
      }

      set({
        totalChants: data.total_chants,
        chantsUntilNextReward: data.chants_until_next_reward,
        walletCredits: data.wallet.credits,
        rewardsAwarded: data.rewards_awarded,
        creditsAwarded: data.credits_awarded,
        claiming: false,
        error: null,
      });

      return data;
    } catch (error) {
      console.error("FAILED TO CLAIM MANTRA:", error);

      const message =
        error instanceof Error
          ? error.message
          : "Failed to claim mantra";

      set({
        claiming: false,
        error: message,
      });

      throw error;
    }
  },

  fetchLeaderboard: async (period = "daily") => {
    try {
      set({
        leaderboardLoading: true,
        leaderboardPeriod: period,
        error: null,
      });

      const response = await fetch(
        `${API_URL}/mantra/leaderboard?period=${period}`,
        {
          method: "GET",
          headers: await authHeaders(),
        }
      );

      const data =
        await parseApiResponse<LeaderboardResponse>(response);

      set({
        leaderboard: Array.isArray(data.leaderboard)
          ? data.leaderboard
          : [],
        myRank: data.my_rank ?? null,
        leaderboardPeriod: data.period ?? period,
        leaderboardLoading: false,
        error: null,
      });
    } catch (error) {
      console.error(
        "FAILED TO FETCH MANTRA LEADERBOARD:",
        error
      );

      set({
        leaderboardLoading: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch leaderboard",
      });
    }
  },

  clearMantraStore: () => {
    set(initialState);
  },
}));
