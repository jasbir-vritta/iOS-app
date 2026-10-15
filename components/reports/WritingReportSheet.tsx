import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import CosmicLoader from "../CosmicLoader";

// App palette.
const C = {
  ink: "#1C1820",
  muted: "#68616A",
  sheet: "#FFFDFC",
  lavender: "#F4F0F8",
  line: "#D9CEC1",
  gold: "#C49A4A",
};

type Props = {
  visible: boolean;
  onClose: () => void;
};

/** Shown after paying: the report is being written (the user can leave). */
export default function WritingReportSheet({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 20 }]}>
          <View style={s.handle} />

          <Pressable onPress={onClose} hitSlop={8} style={s.closeButton} accessibilityLabel="Close">
            <Icon name="close" size={22} color={C.ink} />
          </Pressable>

          <View style={s.loader}>
            <CosmicLoader size={170} />
          </View>

          <View style={s.kickerRow}>
            <Icon name="star-four-points" size={12} color={C.gold} />
            <Text style={s.kicker}>READING YOUR CHART</Text>
          </View>
          <Text style={s.title}>Writing your report…</Text>
          <Text style={s.subtitle}>It takes about 2 - 5 minutes to generate your report.</Text>

          <View style={s.note}>
            <Icon name="bell-ring-outline" size={18} color={C.muted} />
            <Text style={s.noteText}>
              {"You can explore the app in the meantime; your report will appear on this report page when it's done."}
            </Text>
          </View>
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
  kickerRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  kicker: { color: C.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1.2 },
  title: { color: C.ink, fontSize: 22, fontWeight: "800", marginTop: 6 },
  subtitle: { color: C.ink, fontSize: 15.5, textAlign: "center", marginTop: 8 },
  note: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 22, padding: 14, borderRadius: 16, backgroundColor: C.lavender, alignSelf: "stretch" },
  noteText: { flex: 1, color: C.muted, fontSize: 14, lineHeight: 21 },
});
