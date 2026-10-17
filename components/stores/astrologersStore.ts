import { create } from "zustand";
import { API_URL, authHeaders } from "../../lib/auth";
import { onLanguageChange } from "../../lib/i18n";

export type Astrologer = {
  id: string;
  astrologer_id: string;
  name: string;
  type: string;
  specialties: string[];
  archetype: string;
  archetypeIcon: string;
  experience: number;
  description: string;
  price: number;
  oldPrice: number;
  discount: string;
  consultations: number;
  topics: {
    label: string;
    icon: string;
  }[];
  avatar: string;
  photo: any;
  online: boolean;
};

interface AstrologersStore {
  astrologers: Astrologer[];
  loading: boolean;
  error: string | null;

  fetchAstrologers: () => Promise<void>;
  clearAstrologers: () => void;
}

export const useAstrologersStore =
  create<AstrologersStore>((set, get) => ({
    astrologers: [],
    loading: false,
    error: null,

    fetchAstrologers: async () => {
      // A refresh keeps the current list on screen (no spinner).
      const hasList = get().astrologers.length > 0;
      try {
        set({
          loading: !hasList,
          error: null,
        });

        const response = await fetch(
          `${API_URL}/api/astrologers`,
          {
            method: "GET",
            headers: await authHeaders(),
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.detail ||
              "Failed to fetch astrologers"
          );
        }

        const experts = Array.isArray(
          data?.astrologers
        )
          ? data.astrologers
          : [];

        set({
          astrologers: experts,
          loading: false,
          error: null,
        });
      } catch (error) {
        console.error(
          "FAILED TO FETCH ASTROLOGERS:",
          error
        );

        set({
          // A failed refresh keeps the list already shown.
          astrologers: hasList ? get().astrologers : [],
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to fetch astrologers",
        });
      }
    },

    clearAstrologers: () => {
      set({
        astrologers: [],
        loading: false,
        error: null,
      });
    },
  }));

// New language: bios and topics come back in it.
onLanguageChange(() => {
  void useAstrologersStore.getState().fetchAstrologers();
});
