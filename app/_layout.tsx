// NativeWind styles for every screen (login and onboarding open before
// the tabs, so loading them in the tabs layout was too late on iOS).
import "../global.css";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { Platform, Text, TextInput } from "react-native";

import { initAnalytics, useScreenTracking } from "../lib/analytics";

// Keep the native splash until the first screen has drawn, so there is no
// blank frame before the animated splash (app/index.tsx) appears.
SplashScreen.preventAutoHideAsync();

// Mixpanel: start as early as possible so first-screen events are kept.
initAnalytics();

const sansFont =
  Platform.OS === "ios" ? "System" : "sans-serif";

Text.defaultProps = {
  ...Text.defaultProps,
  style: {
    ...(Text.defaultProps?.style || {}),
    fontFamily: sansFont,
  },
};

TextInput.defaultProps = {
  ...TextInput.defaultProps,
  style: {
    ...(TextInput.defaultProps?.style || {}),
    fontFamily: sansFont,
  },
};

export default function RootLayout() {
  useScreenTracking();

  // Runs after the first screen is on screen (index shows the animated
  // splash on the same plum background; deep links show their screen).
  useEffect(() => {
    SplashScreen.hide();
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}