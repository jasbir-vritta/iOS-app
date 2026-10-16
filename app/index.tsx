import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StatusBar } from "react-native";

import { AnimatedSplash, SPLASH_MIN_DURATION } from "../components/splash/AnimatedSplash";
import useAuthStore from "../components/stores/authStore";
import { track } from "../lib/analytics";

// Launch screen: plays the animated splash while the saved session loads,
// then opens the app (signed in) or the login flow.
export default function LaunchScreen() {
    const {
        user,
        isAuthenticated,
        initializeAuth,
        authInitialized,
    } = useAuthStore();

    // Let the animation play through once, even if the session loads instantly.
    const [animationDone, setAnimationDone] = useState(false);

    // Analytics: the splash screen was shown (every app launch).
    useEffect(() => {
        track("visited_splash_screen");
    }, []);

    useEffect(() => {
        initializeAuth();
    }, [initializeAuth]);

    useEffect(() => {
        const timer = setTimeout(() => setAnimationDone(true), SPLASH_MIN_DURATION);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (!authInitialized || !animationDone) return;

        if (isAuthenticated) {
            // Signed in but onboarding not finished (e.g. the app was closed
            // on that screen): back to onboarding, not Home. Accounts from
            // before the "onboarded" flag have a profile, so they go Home.
            const needsOnboarding = !user?.onboarded && !user?.active_profile_id;
            router.replace(needsOnboarding ? "/(auth)/onboarding" : "/(root)/(tabs)");
        } else {
            router.replace("/(auth)");
        }
    }, [authInitialized, isAuthenticated, animationDone, user]);

    return (
        <>
            <StatusBar barStyle="light-content" backgroundColor="#2B1A3D" />
            <AnimatedSplash />
        </>
    );
}
