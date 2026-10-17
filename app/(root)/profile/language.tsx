import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StatusBar, StyleSheet, View } from "react-native";
import Reanimated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "../../../components/ui/BrandText";
import { useLanguageStore, useT } from "../../../lib/i18n";

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

export default function Language() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const current = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  // From the backend, so new languages show up without an app update.
  const languages = useLanguageStore((state) => state.languages);
  const refreshLanguages = useLanguageStore((state) => state.refreshLanguages);

  useEffect(() => {
    void refreshLanguages();
  }, [refreshLanguages]);
  const [selectedLanguage, setSelectedLanguage] = useState<string>(current);
  const [saving, setSaving] = useState(false);

  // Applies to every screen at once and is saved to the account.
  const handleSave = async () => {
    try {
      setSaving(true);
      // Downloads that language's text the first time (then it's saved).
      const ok = await setLanguage(selectedLanguage);
      if (!ok) {
        Alert.alert(t("language.notReadyTitle"), t("language.notReady"));
        return;
      }
      router.back();
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
          <Text style={s.title}>{t("language.title")}</Text>
          <Text style={s.subtitle}>{t("language.subtitle")}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        {/* Intro */}
        <Reanimated.View entering={FadeInDown.duration(400)} style={s.intro}>
          <View style={s.introIcon}>
            <Icon name="translate" size={22} color={C.PLUM} />
          </View>
          <Text style={s.introText}>{t("language.intro")}</Text>
        </Reanimated.View>

        <Text style={s.overline}>{t("language.count", { count: languages.length })}</Text>

        {/* Languages */}
        <View style={{ gap: 10 }}>
          {languages.map((language, index) => {
            const selected = selectedLanguage === language.code;
            return (
              <Reanimated.View key={language.code} entering={FadeInDown.delay(40 * index).duration(380)}>
                <Pressable
                  onPress={() => language.available && setSelectedLanguage(language.code)}
                  disabled={!language.available}
                  style={[s.row, selected && s.rowSelected, !language.available && s.rowDisabled]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <View style={[s.glyph, selected && s.glyphSelected]}>
                    <Text style={[s.glyphText, selected && s.glyphTextSelected]}>{language.glyph}</Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={s.name}>{language.label}</Text>
                    {language.english !== language.label && <Text style={s.english}>{language.english}</Text>}
                  </View>

                  {!language.available ? (
                    <View style={s.soon}>
                      <Text style={s.soonText}>{t("common.comingSoon")}</Text>
                    </View>
                  ) : selected ? (
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
              <Text style={s.saveText}>{t("language.save")}</Text>
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
  rowDisabled: { opacity: 0.55 },
  soon: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: C.SOFT },
  soonText: { fontSize: 10.5, fontWeight: "700", color: C.PLUM },
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
