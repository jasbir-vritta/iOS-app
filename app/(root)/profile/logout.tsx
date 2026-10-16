import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  ImageBackground,
  Pressable,
  StatusBar,
  View,
} from "react-native";

import { Text } from "../../../components/ui/BrandText";
import useAuthStore from "../../../components/stores/authStore";

export default function Logout() {
  const handleLogout = async () => {
    try {
      // Clears the saved session and the signed-in state (user, profiles).
      await useAuthStore.getState().logout();

      // Replace the current screen so user cannot
      // go back to the authenticated screen.
      // The login screen is app/(auth)/index.jsx, i.e. the "/(auth)" route.
      router.replace("/(auth)");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <ImageBackground
      source={require("../../../assets/images/profile/logout_background.png")}
      resizeMode="cover"
      className="flex-1"
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#F7F1E8"
      />

      <View className="flex-1 px-[16px]">
        {/* Back button */}
        <View className="pt-[18px]">
          <Pressable
            onPress={() => router.back()}
            className="h-[42px] w-[42px] items-center justify-center"
            hitSlop={10}
          >
            <Ionicons
              name="chevron-back"
              size={25}
              color="#1C1820"
            />
          </Pressable>
        </View>

        {/* Main content */}
        <View className="flex-1 items-center justify-center">
          {/* Logout illustration is already inside
              logout_background.png */}

          {/* Title */}
          <Text
            className="text-center text-[23px] font-bold text-[#1C1820]"
            style={{ lineHeight: 30 }}
          >
            Are you sure you want{"\n"}to log out?
          </Text>

          {/* Description */}
          <Text
            className="mt-[12px] max-w-[310px] text-center text-[13px] leading-[19px] text-[#68616A]"
          >
            You can always log in again to access your
            {"\n"}profiles, chat history, and more.
          </Text>

          {/* Buttons */}
          <View className="mt-[28px] w-full max-w-[360px]">
            {/* Logout */}
            <Pressable
              onPress={handleLogout}
              className="h-[52px] items-center justify-center rounded-[13px] bg-[#2B1A3D]"
            >
              <Text className="text-[15px] font-bold text-[#FFFDFC]">
                Log Out
              </Text>
            </Pressable>

            {/* Cancel */}
            <Pressable
              onPress={() => router.back()}
              className="mt-[10px] h-[52px] items-center justify-center rounded-[13px] border border-[#D9CEC1] bg-[#FFFDFC]/80"
            >
              <Text className="text-[15px] font-semibold text-[#2B1A3D]">
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </ImageBackground>
  );
}