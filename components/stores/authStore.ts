import { create } from "zustand";

import {
    API_URL,
    authHeaders,
    clearSession,
    getAccessToken,
    getPhone,
    saveSession,
} from "../../lib/auth";

import { identifyUser, resetAnalytics } from "../../lib/analytics";
import { syncLanguageWithAccount } from "../../lib/i18n";
import { unregisterPushNotifications } from "../../lib/notifications";
import useProfilesStore from "./profilesStore";
import { useUserStore } from "./userStore";

type AuthUser = {
    user_id: string;
    phoneNumber: string;
    onboarded: boolean;
    active_profile_id: string | null;
    [key: string]: any;
};

type AuthState = {
    user: AuthUser | null;
    isAuthenticated: boolean;
    authInitialized: boolean;
    loading: boolean;
    error: string | null;

    loginOrSignup: (
        phoneNumber: string
    ) => Promise<any>;

    initializeAuth: () => Promise<void>;

    logout: () => Promise<void>;
};

const useAuthStore = create<AuthState>((set) => ({
    user: null,
    isAuthenticated: false,
    authInitialized: false,
    loading: false,
    error: null,

    // Login / Signup using phone number
    //
    // Same endpoint handles both:
    // - Existing phoneNumber -> Login
    // - New phoneNumber -> Signup
    loginOrSignup: async (phoneNumber: string) => {
        try {
            set({
                loading: true,
                error: null,
            });

            const response = await fetch(
                `${API_URL}/api/auth`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify({
                        phoneNumber,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data?.detail ||
                        "Authentication failed"
                );
            }

            // Save backend session
            await saveSession(
                data.access_token,
                phoneNumber
            );

            // Keep basic auth information in auth store
            set({
                user: {
                    user_id: data.user_id,
                    phoneNumber,
                    onboarded:
                        data.onboarded ?? false,
                    active_profile_id:
                        data.active_profile_id ??
                        null,
                },

                isAuthenticated: true,
                authInitialized: true,
                loading: false,
                error: null,
            });

            return data;
        } catch (error: any) {
            console.error(
                "Login/Signup error:",
                error
            );

            set({
                loading: false,
                error:
                    error?.message ||
                    "Authentication failed",
            });

            throw error;
        }
    },

    // Restore authentication when app opens.
    //
    // If a token exists, fetch the latest user_details
    // from the backend before deciding whether the user
    // should go to onboarding or home.
    initializeAuth: async () => {
        // Forget the previous answer while checking again: right after
        // login the store still says "not authenticated" from app start,
        // and the launch screen (app/index.tsx) would act on that stale
        // value and send the user back to the login screen.
        set({ authInitialized: false });

        try {
            const token =
                await getAccessToken();

            const phoneNumber =
                await getPhone();

            // No session
            if (!token) {
                set({
                    user: null,
                    isAuthenticated: false,
                    authInitialized: true,
                    error: null,
                });

                return;
            }

            // Get latest user details from backend
            const response = await fetch(
                `${API_URL}/api/user/details`,
                {
                    method: "GET",
                    headers:
                        await authHeaders(),
                }
            );

            const data =
                await response.json();

            if (!response.ok) {
                throw new Error(
                    data?.detail ||
                        "Failed to load user details"
                );
            }

            console.log(
                "Restored user details:",
                data
            );

            // Put complete user details into userStore
            useUserStore
                .getState()
                .updateUser(data);

            // Mixpanel: this launch's events belong to this user.
            // App language: the account's, unless this phone has its own choice.
            syncLanguageWithAccount(data.language);

            identifyUser(data.user_id, {
                name: data.name,
                phone: data.phoneNumber,
                email: data.email,
            });

            // Keep auth information in authStore
            set({
                user: {
                    ...data,

                    phoneNumber:
                        data.phoneNumber ||
                        phoneNumber ||
                        "",

                    active_profile_id:
                        data.active_profile_id ??
                        null,
                },

                isAuthenticated: true,
                authInitialized: true,
                error: null,
            });
        } catch (error: any) {
            console.error(
                "Initialize auth error:",
                error
            );

            set({
                user: null,
                isAuthenticated: false,
                authInitialized: true,
                error:
                    error?.message ||
                    "Failed to initialize auth",
            });
        }
    },

    logout: async () => {
        try {
            // Stop notifications to this phone (needs the session, so first).
            await unregisterPushNotifications();

            // Mixpanel: the next account on this phone starts fresh.
            resetAnalytics();

            // Clear backend session
            await clearSession();

            // Clear user details and profiles from Zustand, so the next
            // account doesn't see this one's data.
            useUserStore
                .getState()
                .clearUser();

            useProfilesStore
                .getState()
                .clearProfiles();

            set({
                user: null,
                isAuthenticated: false,
                authInitialized: true,
                loading: false,
                error: null,
            });
        } catch (error: any) {
            console.error(
                "Logout error:",
                error
            );

            set({
                error:
                    error?.message ||
                    "Failed to logout",
            });
        }
    },
}));

export default useAuthStore;