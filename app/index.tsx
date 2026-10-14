import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StatusBar } from "react-native";

import { AnimatedSplash, SPLASH_MIN_DURATION } from "../components/splash/AnimatedSplash";
import useAuthStore from "../components/stores/authStore";

// Launch screen: plays the animated splash while the saved session loads,
// then opens the app (signed in) or the login flow.
export default function LaunchScreen() {
    const {
        isAuthenticated,
        initializeAuth,
        authInitialized,
    } = useAuthStore();

    // Let the animation play through once, even if the session loads instantly.
    const [animationDone, setAnimationDone] = useState(false);

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
            router.replace("/(root)/(tabs)");
        } else {
            router.replace("/(auth)");
        }
    }, [authInitialized, isAuthenticated, animationDone]);

    return (
        <>
            <StatusBar barStyle="light-content" backgroundColor="#2B1A3D" />
            <AnimatedSplash />
        </>
    );
}
