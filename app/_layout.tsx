import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { Platform, Text, TextInput } from "react-native";

// Keep the native splash until the first screen has drawn, so there is no
// blank frame before the animated splash (app/index.tsx) appears.
SplashScreen.preventAutoHideAsync();

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