import { create } from "zustand";

import {
    API_URL,
    authHeaders,
} from "../../lib/auth";

export type Profile = {
  profile_id: string;
  name: string;
  placeOfBirth: string;
  dateOfBirth: string;
  timeOfBirth: string;
  gender: string;
  language: string;
  lat: string;
  lon: string;
  tzone: string;
  maritalStatus?: string;
  // Profile photo (public bucket URL), also shown on the leaderboard.
  avatar_url?: string | null;
};

type ProfilesStore = {
  profiles: Profile[];
  loading: boolean;
  error: string | null;

  fetchProfiles: () => Promise<void>;

  createProfile: (
    data: Omit<Profile, "profile_id">
  ) => Promise<Profile>;

  updateProfile: (
    profileId: string,
    data: Partial<Omit<Profile, "profile_id">>
  ) => Promise<Profile>;

  deleteProfile: (
    profileId: string
  ) => Promise<void>;

  setProfiles: (profiles: Profile[]) => void;

  addProfile: (profile: Profile) => void;

  updateProfileLocal: (
    profileId: string,
    data: Partial<Profile>
  ) => void;

  removeProfile: (profileId: string) => void;

  clearProfiles: () => void;
};

const useProfilesStore = create<ProfilesStore>(
  (set) => ({
    profiles: [],
    loading: false,
    error: null,

    // =====================================================
    // FETCH PROFILES
    // =====================================================

    fetchProfiles: async () => {
      try {
        set({
          loading: true,
          error: null,
        });

        const response = await fetch(
          `${API_URL}/api/user/profiles`,
          {
            method: "GET",
            headers: await authHeaders(),
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.detail ||
              "Failed to fetch profiles"
          );
        }

        set({
          profiles: data.profiles || [],
          loading: false,
          error: null,
        });
      } catch (error: any) {
        console.error(
          "Fetch profiles error:",
          error
        );

        set({
          loading: false,
          error:
            error?.message ||
            "Failed to fetch profiles",
        });

        throw error;
      }
    },

    // =====================================================
    // CREATE PROFILE
    // =====================================================

    createProfile: async (profileData) => {
      try {
        set({
          loading: true,
          error: null,
        });

        const response = await fetch(
          `${API_URL}/api/user/profiles`,
          {
            method: "POST",
            headers: await authHeaders(),
            body: JSON.stringify(profileData),
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.detail ||
              "Failed to create profile"
          );
        }

        const profile =
          data.profile as Profile;

        set((state) => ({
          profiles: [
            ...state.profiles,
            profile,
          ],
          loading: false,
          error: null,
        }));

        return profile;
      } catch (error: any) {
        console.error(
          "Create profile error:",
          error
        );

        set({
          loading: false,
          error:
            error?.message ||
            "Failed to create profile",
        });

        throw error;
      }
    },

    // =====================================================
    // UPDATE PROFILE
    // =====================================================

    updateProfile: async (
      profileId,
      profileData
    ) => {
      try {
        set({
          loading: true,
          error: null,
        });

        const response = await fetch(
          `${API_URL}/api/user/profiles/${profileId}`,
          {
            method: "PUT",
            headers: await authHeaders(),
            body: JSON.stringify(profileData),
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.detail ||
              "Failed to update profile"
          );
        }

        const updatedProfile =
          data.profile as Profile;

        set((state) => ({
          profiles: state.profiles.map(
            (profile) =>
              profile.profile_id ===
              profileId
                ? updatedProfile
                : profile
          ),
          loading: false,
          error: null,
        }));

        return updatedProfile;
      } catch (error: any) {
        console.error(
          "Update profile error:",
          error
        );

        set({
          loading: false,
          error:
            error?.message ||
            "Failed to update profile",
        });

        throw error;
      }
    },

    // =====================================================
    // DELETE PROFILE
    // =====================================================

    deleteProfile: async (profileId) => {
      try {
        set({
          loading: true,
          error: null,
        });

        const response = await fetch(
          `${API_URL}/api/user/profiles/${profileId}`,
          {
            method: "DELETE",
            headers: await authHeaders(),
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.detail ||
              "Failed to delete profile"
          );
        }

        set((state) => ({
          profiles: state.profiles.filter(
            (profile) =>
              profile.profile_id !==
              profileId
          ),
          loading: false,
          error: null,
        }));
      } catch (error: any) {
        console.error(
          "Delete profile error:",
          error
        );

        set({
          loading: false,
          error:
            error?.message ||
            "Failed to delete profile",
        });

        throw error;
      }
    },

    // =====================================================
    // SET PROFILES
    // =====================================================

    setProfiles: (profiles) =>
      set({
        profiles,
        error: null,
      }),

    // =====================================================
    // ADD PROFILE LOCALLY
    // =====================================================

    addProfile: (profile) =>
      set((state) => ({
        profiles: [
          ...state.profiles,
          profile,
        ],
      })),

    // =====================================================
    // UPDATE PROFILE LOCALLY
    // =====================================================

    updateProfileLocal: (
      profileId,
      data
    ) =>
      set((state) => ({
        profiles: state.profiles.map(
          (profile) =>
            profile.profile_id ===
            profileId
              ? {
                  ...profile,
                  ...data,
                }
              : profile
        ),
      })),

    // =====================================================
    // REMOVE PROFILE LOCALLY
    // =====================================================

    removeProfile: (profileId) =>
      set((state) => ({
        profiles: state.profiles.filter(
          (profile) =>
            profile.profile_id !==
            profileId
        ),
      })),

    // =====================================================
    // CLEAR PROFILES
    // =====================================================

    clearProfiles: () =>
      set({
        profiles: [],
        loading: false,
        error: null,
      }),
  })
);

export default useProfilesStore;