import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useT } from "../../lib/i18n";
import CosmicLoader from "../CosmicLoader";

// App palette.
const C = {
  ink: "#1C1820",
  plum: "#2B1A3D",
  muted: "#68616A",
  sheet: "#FFFDFC",
  lavender: "#F4F0F8",
  line: "#D9CEC1",
  gold: "#C49A4A",
  green: "#2E7D4F",
  greenSoft: "#E6F2EA",
};

type Props = {
  visible: boolean;
  onClose: () => void;
  // Set once the report is ready: the same sheet then offers to open it.
  readyTitle?: string | null;
  onOpen?: () => void;
};

/**
 * The one sheet after paying: "Writing your report…" while it's made (the
 * user can leave), then "Your report is ready" with Open report / Later.
 */
export default function WritingReportSheet({ visible, onClose, readyTitle, onOpen }: Props) {
  const insets = useSafeAreaInsets();
  const t = useT();
  const ready = Boolean(readyTitle);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 20 }]}>
          <View style={s.handle} />

          <Pressable onPress={onClose} hitSlop={8} style={s.closeButton} accessibilityLabel={t("common.close")}>
            <Icon name="close" size={22} color={C.ink} />
          </Pressable>

          {ready ? (
            <>
              <View style={s.readyIcon}>
                <Icon name="check-decagram" size={44} color={C.green} />
              </View>

              <View style={s.kickerRow}>
                <Icon name="star-four-points" size={12} color={C.gold} />
                <Text style={s.kicker}>{t("reports.writing.addedKicker")}</Text>
              </View>
              <Text style={s.title}>{t("reports.writing.readyTitle")}</Text>
              <Text style={s.subtitle}>{t("reports.writing.readyText", { title: readyTitle || "" })}</Text>

              <TouchableOpacity activeOpacity={0.85} onPress={onOpen} style={s.openButton}>
                <Icon name="book-open-page-variant-outline" size={18} color={C.sheet} />
                <Text style={s.openText}>{t("reports.openReport")}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} hitSlop={8} style={s.laterButton}>
                <Text style={s.laterText}>{t("reports.writing.later")}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={s.loader}>
                <CosmicLoader size={170} />
              </View>

              <View style={s.kickerRow}>
                <Icon name="star-four-points" size={12} color={C.gold} />
                <Text style={s.kicker}>{t("reports.writing.kicker")}</Text>
              </View>
              <Text style={s.title}>{t("reports.writing.title")}</Text>
              <Text style={s.subtitle}>{t("reports.writing.subtitle")}</Text>

              <View style={s.note}>
                <Icon name="bell-ring-outline" size={18} color={C.muted} />
                <Text style={s.noteText}>
                  {t("reports.writing.note")}
                </Text>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(43,26,61,0.45)" },
  sheet: { backgroundColor: C.sheet, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 24, paddingTop: 10, alignItems: "center" },
  handle: { width: 48, height: 5, borderRadius: 3, backgroundColor: C.line },
  closeButton: { position: "absolute", top: 22, right: 20, width: 46, height: 46, borderRadius: 23, backgroundColor: C.lavender, alignItems: "center", justifyContent: "center" },
  loader: { marginTop: 40, marginBottom: 20 },
  readyIcon: {
    marginTop: 48,
    marginBottom: 18,
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.greenSoft,
  },
  kickerRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  kicker: { color: C.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1.2 },
  title: { color: C.ink, fontSize: 22, fontWeight: "800", marginTop: 6 },
  subtitle: { color: C.ink, fontSize: 15.5, textAlign: "center", marginTop: 8 },
  note: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 22, padding: 14, borderRadius: 16, backgroundColor: C.lavender, alignSelf: "stretch" },
  noteText: { flex: 1, color: C.muted, fontSize: 14, lineHeight: 21 },
  openButton: {
    alignSelf: "stretch",
    marginTop: 24,
    height: 52,
    borderRadius: 999,
    backgroundColor: C.plum,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  openText: { color: C.sheet, fontSize: 15.5, fontWeight: "700" },
  laterButton: { marginTop: 12, paddingVertical: 8, paddingHorizontal: 20 },
  laterText: { color: C.muted, fontSize: 14.5, fontWeight: "600" },
});
