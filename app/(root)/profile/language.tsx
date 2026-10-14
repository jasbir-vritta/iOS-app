import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ImageBackground, Pressable, StatusBar, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const LANGUAGE_KEY = "app_language";

const languages = ["English", "हिंदी", "Hinglish", "मराठी", "বাংলা", "తెలుగు", "ಕನ್ನಡ"];

export default function Language() {
  const [selectedLanguage, setSelectedLanguage] = useState("English");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(LANGUAGE_KEY);
        if (saved) setSelectedLanguage(saved);
      } catch (error) {
        console.error("Failed to load language:", error);
      }
    })();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      await AsyncStorage.setItem(LANGUAGE_KEY, selectedLanguage);
      router.back();
    } catch (error) {
      console.error("Failed to save language:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ImageBackground
      source={require("../../../assets/images/profile/language.png")}
      resizeMode="cover"
      style={{ flex: 1 }}
    >
      <StatusBar barStyle="dark-content" />

      <SafeAreaView style={{ flex: 1 }}>
        <View className="flex-1 px-[18px]">
          {/* Back */}
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            className="-ml-[8px] mt-[8px] h-[44px] w-[44px] items-center justify-center"
          >
            <Ionicons name="chevron-back" size={26} color="#1C1820" />
          </Pressable>

          {/* Header */}
          <View className="relative mt-[8px] flex-row items-center">
            <View className="h-[54px] w-[54px] items-center justify-center rounded-full bg-[#EDE7F3]">
              <Ionicons name="globe-outline" size={28} color="#2B1A3D" />
            </View>

            <View className="ml-[14px] flex-1">
              <Text className="text-[21px] font-bold text-[#2B1A3D]">App Language</Text>
              <Text className="mt-[3px] text-[13px] leading-[18px] text-[#68616A]">
                {"Choose your preferred language\nfor the app."}
              </Text>
            </View>

            {/* Gold sparkles (tiny accents) */}
            <Text className="absolute right-[44px] top-[2px] text-[24px] text-[#C49A4A]">✦</Text>
            <Text className="absolute -bottom-[16px] right-[6px] text-[11px] text-[#C49A4A]">✦</Text>
          </View>

          {/* Languages */}
          <View className="mt-[26px]">
            {languages.map((language) => {
              const isSelected = selectedLanguage === language;

              return (
                <Pressable
                  key={language}
                  onPress={() => setSelectedLanguage(language)}
                  className={`mb-[12px] min-h-[58px] flex-row items-center rounded-[14px] border px-[18px] ${
                    isSelected ? "border-[#E6CFCA] bg-[#F9ECE9]" : "border-[#D9CEC1] bg-[#FFFDFC]"
                  }`}
                >
                  {/* Radio: filled plum + check when selected, thin ring otherwise */}
                  {isSelected ? (
                    <View className="mr-[16px] h-[26px] w-[26px] items-center justify-center rounded-full bg-[#2B1A3D]">
                      <Ionicons name="checkmark" size={17} color="#FFFDFC" />
                    </View>
                  ) : (
                    <View className="mr-[16px] h-[26px] w-[26px] rounded-full border-[1.5px] border-[#8A8190]" />
                  )}

                  <Text
                    className={`text-[17px] ${
                      isSelected ? "font-semibold text-[#1C1820]" : "text-[#1C1820]"
                    }`}
                  >
                    {language}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Push the button to the bottom */}
          <View className="flex-1" />

          {/* Save */}
          <Pressable
            onPress={handleSave}
            disabled={saving}
            className={`mb-[14px] h-[58px] flex-row items-center justify-center rounded-[16px] bg-[#2B1A3D] ${
              saving ? "opacity-60" : ""
            }`}
          >
            <Text className="text-[17px] font-semibold text-[#FFFDFC]">
              {saving ? "Saving..." : "Save Language"}
            </Text>
            <Ionicons
              name="arrow-forward"
              size={23}
              color="#FFFDFC"
              style={{ position: "absolute", right: 22 }}
            />
          </Pressable>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}