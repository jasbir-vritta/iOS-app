import { create } from "zustand";
import { API_URL, authHeaders } from "../../lib/auth";

export type RewardType =
  | "mantra_daily"
  | "conversation_daily"
  | "insight_daily";

export interface RewardActivity {
  credits: number;
  completed: boolean;
}

export interface RewardsData {
  walletCredits: number;

  today: {
    earned: number;
    maximum: number;
  };

  activities: Record<RewardType, RewardActivity>;

  mantraStreak: {
    // Position in the current run of `target` days (1..target).
    current: number;
    target: number;
    bonus: number;
    // Whole run, e.g. 9 days in a row (India time).
    days: number;
    // A round of 108 is already done today.
    completedToday: boolean;
  };
}

interface RewardsStoreState {
  rewards: RewardsData | null;
  loading: boolean;
  error: string | null;

  fetchRewards: () => Promise<void>;

  setRewards: (rewards: RewardsData) => void;

  updateWalletCredits: (credits: number) => void;

  markRewardCompleted: (
    rewardType: RewardType,
    credits?: number
  ) => void;

  completeInsightReward: () => Promise<void>;

  updateMantraStreak: (
    current: number,
    target?: number,
    bonus?: number
  ) => void;

  clearRewards: () => void;
}

const DEFAULT_REWARDS: RewardsData = {
  walletCredits: 0,

  today: {
    earned: 0,
    maximum: 10,
  },

  activities: {
    // Same amounts as the backend's REWARD_CONFIG.
    mantra_daily: {
      credits: 3,
      completed: false,
    },

    conversation_daily: {
      credits: 5,
      completed: false,
    },

    insight_daily: {
      credits: 2,
      completed: false,
    },
  },

  mantraStreak: {
    current: 0,
    target: 7,
    bonus: 20,
    days: 0,
    completedToday: false,
  },
};

export const useRewardsStore = create<RewardsStoreState>(
  (set, get) => ({
    rewards: DEFAULT_REWARDS,

    loading: false,

    error: null,

    // ============================================================
    // Fetch rewards
    // ============================================================

    fetchRewards: async () => {
      set({
        loading: true,
        error: null,
      });

      try {
        const headers = await authHeaders();

        const response = await fetch(
          `${API_URL}/rewards/today`,
          {
            method: "GET",
            headers,
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.detail || "Failed to fetch rewards"
          );
        }

        const activities = data?.activities ?? {};

        // Mantra rewards repeat (every 108 chants), so the backend sends
        // `credits_per_session` for them instead of `credits`.
        const mantraCredits =
          activities.mantra_daily?.credits_per_session ??
          activities.mantra_daily?.credits ??
          3;
        const conversationCredits =
          activities.conversation_daily?.credits ?? 5;
        const insightCredits =
          activities.insight_daily?.credits ?? 2;

        // Daily target: one of each activity (3 + 5 + 2). Older backends
        // left the mantra out (7), so never go below the sum.
        const dailyTarget = Math.max(
          Number(data?.today?.maximum) || 0,
          mantraCredits + conversationCredits + insightCredits
        );

        const rewards: RewardsData = {
          walletCredits:
            data?.wallet?.credits ?? 0,

          today: {
            earned:
              data?.today?.earned ?? 0,

            maximum: dailyTarget,
          },

          activities: {
            mantra_daily: {
              credits: mantraCredits,

              completed:
                activities.mantra_daily?.completed ??
                false,
            },

            conversation_daily: {
              credits: conversationCredits,

              completed:
                activities.conversation_daily
                  ?.completed ?? false,
            },

            insight_daily: {
              credits: insightCredits,

              completed:
                activities.insight_daily?.completed ??
                false,
            },
          },

          mantraStreak: {
            current:
              data?.streak?.current ??
              data?.streak?.days ??
              0,

            target:
              data?.streak?.target ?? 7,

            bonus:
              data?.streak?.bonus ?? 20,

            days:
              data?.streak?.days ?? 0,

            completedToday:
              data?.streak?.completed_today ?? false,
          },
        };

        set({
          rewards,
          loading: false,
          error: null,
        });
      } catch (error) {
        console.error(
          "Failed to fetch rewards:",
          error
        );

        set({
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to fetch rewards",
        });
      }
    },

    // ============================================================
    // Set rewards
    // ============================================================

    setRewards: (rewards) => {
      set({
        rewards,
      });
    },

    // ============================================================
    // Update wallet credits
    // ============================================================

    updateWalletCredits: (credits) => {
      set((state) => {
        if (!state.rewards) {
          return state;
        }

        return {
          rewards: {
            ...state.rewards,

            walletCredits: credits,
          },
        };
      });
    },

    // ============================================================
    // Mark reward completed
    //
    // NOTE:
    // This is still a local-only helper.
    // Backend-driven rewards should use their API endpoint.
    // ============================================================

    markRewardCompleted: (
      rewardType,
      credits
    ) => {
      set((state) => {
        if (!state.rewards) {
          return state;
        }

        const current =
          state.rewards.activities[rewardType];

        if (current.completed) {
          return state;
        }

        const rewardCredits =
          credits ?? current.credits;

        return {
          rewards: {
            ...state.rewards,

            today: {
              ...state.rewards.today,

              earned:
                state.rewards.today.earned +
                rewardCredits,
            },

            activities: {
              ...state.rewards.activities,

              [rewardType]: {
                credits: rewardCredits,
                completed: true,
              },
            },
          },
        };
      });
    },

    // ============================================================
    // Complete insight reward
    //
    // Backend is the source of truth.
    //
    // POST /rewards/claim
    // {
    //   "reward_type": "insight_daily"
    // }
    // ============================================================

    completeInsightReward: async () => {
      try {
        const headers = await authHeaders();

        const response = await fetch(
          `${API_URL}/rewards/claim`,
          {
            method: "POST",

            headers: {
              ...headers,
              "Content-Type": "application/json",
            },

            body: JSON.stringify({
              reward_type: "insight_daily",
            }),
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.detail ||
              "Failed to claim insight reward"
          );
        }

        // Refresh from backend so Zustand
        // always reflects the actual DB state.
        await get().fetchRewards();
      } catch (error) {
        console.error(
          "Failed to complete insight reward:",
          error
        );
      }
    },

    // ============================================================
    // Update mantra streak
    // ============================================================

    updateMantraStreak: (
      current,
      target,
      bonus
    ) => {
      set((state) => {
        if (!state.rewards) {
          return state;
        }

        return {
          rewards: {
            ...state.rewards,

            mantraStreak: {
              ...state.rewards.mantraStreak,

              current,

              target:
                target ??
                state.rewards.mantraStreak.target,

              bonus:
                bonus ??
                state.rewards.mantraStreak.bonus,
            },
          },
        };
      });
    },

    // ============================================================
    // Clear rewards
    // ============================================================

    clearRewards: () => {
      set({
        rewards: DEFAULT_REWARDS,
        loading: false,
        error: null,
      });
    },
  })
);