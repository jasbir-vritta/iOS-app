import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StatusBar, StyleSheet, View } from "react-native";
import Reanimated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "../../../components/ui/BrandText";

const LANGUAGE_KEY = "app_language";

const C = {
  INK: "#1C1820",
  PLUM: "#2B1A3D",
  GOLD: "#C49A4A",
  LAVENDER: "#F4F0F8",
  CARD: "#FFFDFC",
  MUTED: "#68616A",
  LINE: "rgba(217,206,193,0.7)",
  SOFT: "#EFE8F7",
};

// `value` is what's saved (unchanged), with its English name and a letter
// in its own script for the tile.
const languages = [
  { value: "English", english: "English", glyph: "Aa" },
  { value: "हिंदी", english: "Hindi", glyph: "अ" },
  { value: "Hinglish", english: "Hindi in English letters", glyph: "Aअ" },
  { value: "मराठी", english: "Marathi", glyph: "म" },
  { value: "বাংলা", english: "Bengali", glyph: "অ" },
  { value: "తెలుగు", english: "Telugu", glyph: "అ" },
  { value: "ಕನ್ನಡ", english: "Kannada", glyph: "ಅ" },
];

export default function Language() {
  const insets = useSafeAreaInsets();
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
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={s.backButton} accessibilityLabel="Go back">
          <Icon name="chevron-left" size={24} color={C.INK} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>App language</Text>
          <Text style={s.subtitle}>Choose the language you&apos;re most comfortable with</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        {/* Intro */}
        <Reanimated.View entering={FadeInDown.duration(400)} style={s.intro}>
          <View style={s.introIcon}>
            <Icon name="translate" size={22} color={C.PLUM} />
          </View>
          <Text style={s.introText}>
            You can still chat with astrologers in any language, whatever you choose here.
          </Text>
        </Reanimated.View>

        <Text style={s.overline}>{`${languages.length} LANGUAGES`}</Text>

        {/* Languages */}
        <View style={{ gap: 10 }}>
          {languages.map((language, index) => {
            const selected = selectedLanguage === language.value;
            return (
              <Reanimated.View key={language.value} entering={FadeInDown.delay(40 * index).duration(380)}>
                <Pressable
                  onPress={() => setSelectedLanguage(language.value)}
                  style={[s.row, selected && s.rowSelected]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <View style={[s.glyph, selected && s.glyphSelected]}>
                    <Text style={[s.glyphText, selected && s.glyphTextSelected]}>{language.glyph}</Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={s.name}>{language.value}</Text>
                    {language.english !== language.value && <Text style={s.english}>{language.english}</Text>}
                  </View>

                  {selected ? (
                    <View style={s.check}>
                      <Icon name="check" size={15} color={C.CARD} />
                    </View>
                  ) : (
                    <View style={s.radio} />
                  )}
                </Pressable>
              </Reanimated.View>
            );
          })}
        </View>
      </ScrollView>

      {/* Save */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable onPress={handleSave} disabled={saving} style={[s.save, saving && { opacity: 0.6 }]}>
          {saving ? (
            <ActivityIndicator color={C.CARD} />
          ) : (
            <>
              <Icon name="check" size={19} color={C.CARD} />
              <Text style={s.saveText}>Save language</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const shadow = {
  shadowColor: "#2B1A3D",
  shadowOpacity: 0.06,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
};

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.LAVENDER },

  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: C.LINE,
  },
  title: { fontSize: 21, fontWeight: "700", color: C.INK, letterSpacing: -0.3 },
  subtitle: { marginTop: 1, fontSize: 12.5, color: C.MUTED },

  content: { paddingHorizontal: 16, paddingBottom: 24 },

  intro: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: C.LINE,
  },
  introIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.SOFT,
  },
  introText: { flex: 1, fontSize: 12.5, lineHeight: 18, color: C.MUTED },

  overline: { marginTop: 20, marginBottom: 10, fontSize: 11, fontWeight: "700", letterSpacing: 1.3, color: C.GOLD },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 12,
    borderRadius: 18,
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: C.LINE,
    ...shadow,
  },
  rowSelected: { borderColor: C.PLUM, borderWidth: 1.5 },

  glyph: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7F1E8",
  },
  glyphSelected: { backgroundColor: C.PLUM },
  glyphText: { fontSize: 18, fontWeight: "700", color: C.PLUM },
  glyphTextSelected: { color: C.CARD },

  name: { fontSize: 16, fontWeight: "700", color: C.INK },
  english: { marginTop: 1, fontSize: 12, color: C.MUTED },

  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: "#B9AFC0" },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.PLUM,
  },

  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: C.LAVENDER,
    borderTopWidth: 1,
    borderTopColor: C.LINE,
  },
  save: {
    height: 52,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.PLUM,
  },
  saveText: { fontSize: 15, fontWeight: "700", color: C.CARD },
});
