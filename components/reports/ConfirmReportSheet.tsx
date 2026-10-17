import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useT } from "../../lib/i18n";
import PartnerForm, { PartnerDraft } from "./PartnerForm";
import { monthShort } from "./reportText";

// App palette: Card White sheet, Lavender panels, Deep Plum action.
const C = {
  ink: "#1C1820",
  muted: "#68616A",
  sheet: "#FFFDFC",
  card: "#F4F0F8",
  line: "#D9CEC1",
  button: "#2B1A3D",
  gold: "#C49A4A",
  green: "#2E7D4F",
  red: "#B3392F",
  white: "#FFFFFF",
};

// "12/11/1996" -> "12 NOV 1996"
const formatDob = (t: ReturnType<typeof useT>, value?: string) => {
  const [d, m, y] = String(value || "").split("/");
  const month = Number(m);
  return d && m && y && month >= 1 && month <= 12
    ? `${Number(d)} ${monthShort(t, month - 1).toUpperCase()} ${y}`
    : value || "";
};

type Profile = {
  name?: string;
  gender?: string;
  placeOfBirth?: string;
  dateOfBirth?: string;
  timeOfBirth?: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  profile?: Profile;
  price: number;
  oldPrice?: number;
  walletBalance: number;
  languages: Record<string, string>;
  language: string;
  onLanguageChange: (code: string) => void;
  // Language this profile already owns the report in (Buy again).
  ownedLanguage?: string | null;
  onOpenOwned?: () => void;
  // Language codes this report offers (empty = all).
  allowedLanguages?: string[];
  // Future Report: durations to choose from.
  variants?: { id: string; label: string }[];
  variant?: string | null;
  onVariantChange?: (id: string) => void;
  // Kundli Matching: the partner's details (Buy waits until complete).
  partner?: PartnerDraft | null;
  onPartnerChange?: (next: PartnerDraft) => void;
  partnerReady?: boolean;
  // Whose details the form asks for (Baby report: the child).
  personRole?: "partner" | "child";
  // Enough balance: pay and make the report.
  onBuy: () => void;
  // Not enough: go and recharge (the purchase continues on return).
  onAddCash: () => void;
};

/** "Confirm Details" sheet shown before paying for a report. */
export default function ConfirmReportSheet({
  visible,
  onClose,
  profile,
  price,
  oldPrice,
  walletBalance,
  languages,
  language,
  onLanguageChange,
  onBuy,
  onAddCash,
  ownedLanguage,
  onOpenOwned,
  allowedLanguages,
  variants = [],
  variant,
  onVariantChange,
  partner,
  onPartnerChange,
  partnerReady = true,
  personRole = "partner",
}: Props) {
  const insets = useSafeAreaInsets();
  const t = useT();
  const [picking, setPicking] = useState(false);

  const enough = walletBalance >= price;
  const owned = Boolean(ownedLanguage) && ownedLanguage === language;
  const offPercent = oldPrice && oldPrice > price ? Math.round((1 - price / oldPrice) * 100) : 0;
  const genderLetter = String(profile?.gender || "").trim().charAt(0).toUpperCase();
  const allLanguages = Object.entries(languages).length ? Object.entries(languages) : [["en", "English"]];
  const languageList = allowedLanguages?.length
    ? allLanguages.filter(([code]) => allowedLanguages.includes(code))
    : allLanguages;
  const needsPartner = Boolean(partner && onPartnerChange);
  const blocked = needsPartner && !partnerReady;

  const close = () => {
    setPicking(false);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={s.sheet}
        >
          <View style={s.handle} />

          <View style={s.headRow}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Icon name="star-four-points" size={14} color={C.gold} />
                <Text style={s.title} numberOfLines={1} adjustsFontSizeToFit>
                  {t("reports.confirm.title")}
                </Text>
              </View>
              <Text style={s.subtitle}>{t("reports.confirm.subtitle")}</Text>
            </View>
            <Pressable onPress={close} hitSlop={8} style={s.closeButton} accessibilityLabel={t("common.close")}>
              <Icon name="close" size={22} color={C.ink} />
            </Pressable>
          </View>

          <View style={s.rule} />

          <ScrollView style={s.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Who the report is for */}
          <View style={s.card}>
            <View style={s.labelRow}>
              <Icon name="account-voice" size={16} color={C.muted} />
              <Text style={s.label}>{t("reports.confirm.reportFor")}</Text>
            </View>

            <View style={s.personRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.name} numberOfLines={1}>
                  {profile?.name || t("reports.profile")}
                  {genderLetter ? ` (${genderLetter})` : ""}
                </Text>
                <Text style={s.place} numberOfLines={1}>{profile?.placeOfBirth || ""}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={s.date}>{formatDob(t, profile?.dateOfBirth)}</Text>
                <Text style={s.time}>{profile?.timeOfBirth || ""}</Text>
              </View>
            </View>

            <View style={s.cardRule} />

            <View style={s.languageRow}>
              <View style={s.labelRow}>
                <Icon name="translate" size={16} color={C.muted} />
                <Text style={s.label} numberOfLines={1}>
                  {t("reports.confirm.language")}
                </Text>
              </View>
              <Pressable onPress={() => setPicking((v) => !v)} style={s.languageButton}>
                <Text style={s.languageText}>{languages[language] || "English"}</Text>
                <Icon name={picking ? "chevron-up" : "chevron-down"} size={18} color={C.ink} />
              </Pressable>
            </View>

            {picking && (
              <View style={s.languageList}>
                {languageList.map(([code, label]) => (
                  <Pressable
                    key={code}
                    onPress={() => {
                      onLanguageChange(code);
                      setPicking(false);
                    }}
                    style={[s.languageOption, code === language && s.languageOptionOn]}
                  >
                    <Text style={[s.languageOptionText, code === language && { fontWeight: "800" }]}>
                      {label}
                    </Text>
                    {code === language && <Icon name="check" size={16} color={C.button} />}
                  </Pressable>
                ))}
              </View>
            )}

            {variants.length > 0 && (
              <>
                <View style={s.cardRule} />
                <View style={s.labelRow}>
                  <Icon name="calendar-range" size={16} color={C.muted} />
                  <Text style={s.label}>{t("reports.confirm.duration")}</Text>
                </View>
                <View style={s.variantRow}>
                  {variants.map((v) => (
                    <Pressable
                      key={v.id}
                      onPress={() => onVariantChange?.(v.id)}
                      style={[s.variant, v.id === variant && s.variantOn]}
                    >
                      <Text style={[s.variantText, v.id === variant && s.variantTextOn]}>{v.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
          </View>

          {needsPartner && partner && onPartnerChange && (
            <PartnerForm value={partner} onChange={onPartnerChange} who={personRole} />
          )}
          </ScrollView>

          {/* Price and wallet */}
          <View style={s.priceRow}>
            <View>
              {offPercent > 0 && (
                <View style={s.offBadge}>
                  <Text style={s.offText}>{t("reports.percentOffLower", { percent: offPercent })}</Text>
                </View>
              )}
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                <Text style={s.price}>₹{price}</Text>
                {!!oldPrice && oldPrice > price && <Text style={s.oldPrice}>₹{oldPrice}</Text>}
              </View>
            </View>

            <View style={{ alignItems: "flex-end" }}>
              <Text style={s.walletLabel}>{t("reports.confirm.wallet")}</Text>
              <Text style={[s.walletValue, { color: enough ? C.green : C.red }]}>
                ₹{Number.isInteger(walletBalance) ? walletBalance : walletBalance.toFixed(2)}
              </Text>
            </View>
          </View>

          {owned && (
            <Text style={s.ownedNote}>
              {languages[language]
                ? t("reports.confirm.ownedIn", { language: languages[language] })
                : t("reports.confirm.ownedThisLanguage")}
            </Text>
          )}

          <Pressable
            onPress={owned ? onOpenOwned : blocked ? undefined : enough ? onBuy : onAddCash}
            disabled={!owned && blocked}
            style={[s.button, !owned && blocked && s.buttonOff]}
          >
            <Text style={s.buttonText} numberOfLines={1} adjustsFontSizeToFit>
              {owned
                ? t("reports.openReportCta")
                : blocked
                  ? personRole === "child"
                    ? t("reports.confirm.addChildDetails")
                    : t("reports.confirm.addPartnerDetails")
                  : enough
                    ? t("reports.confirm.buyNowPrice", { price })
                    : t("reports.confirm.addCash")}
            </Text>
          </Pressable>

          {!owned && !blocked && !enough && (
            <Text style={s.hint}>
              {t("reports.confirm.addCashHint", { amount: Math.ceil(price - walletBalance) })}
            </Text>
          )}

          {/* Space for the home indicator / nav bar. A spacer, not paddingBottom:
              on iOS KeyboardAvoidingView ("padding") sets its own paddingBottom
              (0 with the keyboard closed), which would drop this space. */}
          <View style={{ height: Math.max(insets.bottom, 16) + 8 }} />
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(43,26,61,0.45)" },
  sheet: { backgroundColor: C.sheet, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 10, maxHeight: "92%" },
  // Shrinks (and scrolls) when the sheet hits its max height, so the price
  // and button below always stay on screen.
  body: { flexGrow: 0, flexShrink: 1 },
  variantRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  variant: { flex: 1, height: 40, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.sheet, alignItems: "center", justifyContent: "center" },
  variantOn: { backgroundColor: C.button, borderColor: C.button },
  variantText: { color: C.ink, fontSize: 14, fontWeight: "600" },
  variantTextOn: { color: C.white },
  buttonOff: { opacity: 0.5 },
  handle: { alignSelf: "center", width: 44, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 18 },
  headRow: { flexDirection: "row", alignItems: "flex-start" },
  title: { color: C.ink, fontSize: 22, fontWeight: "800" },
  subtitle: { color: C.muted, fontSize: 15, marginTop: 4 },
  closeButton: { width: 48, height: 48, borderRadius: 14, backgroundColor: C.card, alignItems: "center", justifyContent: "center" },
  rule: { height: 1, backgroundColor: C.line, marginTop: 18, marginBottom: 16 },

  card: { backgroundColor: C.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#E6DDEF" },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  label: { color: C.muted, fontSize: 14 },
  personRow: { flexDirection: "row", alignItems: "flex-start", marginTop: 12, gap: 12 },
  name: { color: C.ink, fontSize: 18, fontWeight: "800" },
  place: { color: C.muted, fontSize: 14, marginTop: 3 },
  date: { color: C.ink, fontSize: 17, fontWeight: "700" },
  time: { color: C.muted, fontSize: 14, marginTop: 3 },
  cardRule: { height: 1, backgroundColor: C.line, marginVertical: 14 },
  languageRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  languageButton: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, backgroundColor: C.sheet, borderWidth: 1, borderColor: C.line },
  languageText: { color: C.ink, fontSize: 15, fontWeight: "700" },
  languageList: { marginTop: 10, borderRadius: 14, backgroundColor: C.sheet, borderWidth: 1, borderColor: C.line, overflow: "hidden" },
  languageOption: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 11 },
  languageOptionOn: { backgroundColor: "#EFE8F7" },
  languageOptionText: { color: C.ink, fontSize: 15 },

  priceRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 20, marginBottom: 14 },
  offBadge: { alignSelf: "flex-start", backgroundColor: "#E6F2EA", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, marginBottom: 4 },
  offText: { color: C.green, fontSize: 12, fontWeight: "800" },
  price: { color: C.ink, fontSize: 24, fontWeight: "800" },
  oldPrice: { color: C.muted, fontSize: 16, textDecorationLine: "line-through" },
  walletLabel: { color: C.muted, fontSize: 14 },
  walletValue: { fontSize: 20, fontWeight: "800", marginTop: 2 },

  button: { height: 58, borderRadius: 999, backgroundColor: C.button, alignItems: "center", justifyContent: "center", shadowColor: C.button, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  buttonText: { color: C.white, fontSize: 18, fontWeight: "700" },
  hint: { color: C.muted, fontSize: 13, textAlign: "center", marginTop: 10 },
  ownedNote: { color: C.muted, fontSize: 13, textAlign: "center", marginBottom: 10 },
});
