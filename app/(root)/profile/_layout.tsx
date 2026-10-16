import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { View } from "react-native";

import { AUTH_FONTS } from "../../../components/auth/theme";

export default function ChatsLayout() {
  // Profile screens use the brand font: load it before they show.
  const [fontsLoaded] = useFonts(AUTH_FONTS);
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: "#F4F0F8" }} />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}
