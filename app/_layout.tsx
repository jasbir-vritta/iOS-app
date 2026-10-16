// NativeWind styles for every screen (login and onboarding open before
// the tabs, so loading them in the tabs layout was too late on iOS).
import "../global.css";
// Plus Jakarta Sans is the default font for all text (before any screen loads).
import "../lib/brandFont";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";

import { AUTH_FONTS } from "../components/auth/theme";
import { initAnalytics, useScreenTracking } from "../lib/analytics";

// Keep the native splash until the first screen has drawn, so there is no
// blank frame before the animated splash (app/index.tsx) appears.
SplashScreen.preventAutoHideAsync();

// Mixpanel: start as early as possible so first-screen events are kept.
initAnalytics();

export default function RootLayout() {
  useScreenTracking();

  // The brand font loads behind the native splash, so no text ever shows in
  // another font. It ships with the app, so this takes a moment at most.
  const [fontsLoaded, fontError] = useFonts(AUTH_FONTS);
  const ready = fontsLoaded || Boolean(fontError);

  // Runs after the first screen is on screen (index shows the animated
  // splash on the same plum background; deep links show their screen).
  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  if (!ready) return null;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}