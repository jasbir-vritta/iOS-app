import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useT } from "../../lib/i18n";
import type { PartnerDetails } from "../stores/reportsStore";
import { monthShort } from "./reportText";

const C = {
  ink: "#1C1820",
  muted: "#68616A",
  card: "#FFFDFC",
  line: "#D9CEC1",
  plum: "#2B1A3D",
  soft: "#EFE8F7",
};

const pad = (n: number) => String(n).padStart(2, "0");

type Place = {
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
};

export type PartnerDraft = {
  name: string;
  gender: "male" | "female" | "";
  date: Date | null;
  time: Date | null;
  place: Place | null;
};

export const emptyPartner: PartnerDraft = { name: "", gender: "", date: null, time: null, place: null };

/** Ready to send, or null while something is missing. */
export function partnerDetails(d: PartnerDraft): PartnerDetails | null {
  if (!d.name.trim() || !d.gender || !d.date || !d.time || !d.place) return null;
  return {
    name: d.name.trim(),
    gender: d.gender,
    dateOfBirth: `${pad(d.date.getDate())}/${pad(d.date.getMonth() + 1)}/${d.date.getFullYear()}`,
    timeOfBirth: `${pad(d.time.getHours())}:${pad(d.time.getMinutes())}`,
    placeOfBirth: [d.place.name, d.place.admin1].filter(Boolean).join(", "),
    lat: d.place.latitude,
    lon: d.place.longitude,
    tzone: d.place.timezone || "Asia/Kolkata",
  };
}

/** Birth details of the partner (Kundli Matching) or the child (Baby report), inside the Confirm sheet. */
export default function PartnerForm({
  value,
  onChange,
  who = "partner",
}: {
  value: PartnerDraft;
  onChange: (next: PartnerDraft) => void;
  who?: "partner" | "child";
}) {
  const t = useT();
  const child = who === "child";
  const [picker, setPicker] = useState<"date" | "time" | null>(null);
  const [query, setQuery] = useState(value.place ? value.place.name : "");
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);

  const set = (patch: Partial<PartnerDraft>) => onChange({ ...value, ...patch });

  // Birth place: search as they type (same service as onboarding).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || (value.place && value.place.name === q)) {
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en&format=json`
        );
        const json = res.ok ? await res.json() : null;
        if (!cancelled) setResults(Array.isArray(json?.results) ? json.results : []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, value.place]);

  const onPicked = (_: unknown, picked?: Date) => {
    const which = picker;
    if (Platform.OS === "android") setPicker(null);
    if (!picked) return;
    if (which === "date") set({ date: picked });
    if (which === "time") set({ time: picked });
  };

  const dateLabel = value.date
    ? `${value.date.getDate()} ${monthShort(t, value.date.getMonth()).toUpperCase()} ${value.date.getFullYear()}`
    : t("reports.partner.birthDate");
  const timeLabel = value.time
    ? value.time.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })
    : t("reports.partner.birthTime");

  return (
    <View style={s.wrap}>
      <View style={s.labelRow}>
        <Icon name={child ? "baby-face-outline" : "heart-outline"} size={16} color={C.muted} />
        <Text style={s.label}>{child ? t("reports.partner.childDetails") : t("reports.partner.partnerDetails")}</Text>
      </View>

      <TextInput
        value={value.name}
        onChangeText={(name) => set({ name })}
        placeholder={child ? t("reports.partner.childName") : t("reports.partner.partnerName")}
        placeholderTextColor={C.muted}
        style={s.input}
        autoCapitalize="words"
      />

      <View style={s.row}>
        {(["male", "female"] as const).map((g) => (
          <Pressable
            key={g}
            onPress={() => set({ gender: g })}
            style={[s.chip, value.gender === g && s.chipOn]}
          >
            <Text style={[s.chipText, value.gender === g && s.chipTextOn]}>
              {g === "male"
                ? child
                  ? t("reports.partner.boy")
                  : t("common.male")
                : child
                  ? t("reports.partner.girl")
                  : t("common.female")}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={s.row}>
        <Pressable onPress={() => setPicker(picker === "date" ? null : "date")} style={[s.input, s.half]}>
          <Icon name="calendar-month-outline" size={17} color={C.muted} />
          <Text style={[s.pickText, !value.date && s.placeholder]} numberOfLines={1}>
            {dateLabel}
          </Text>
        </Pressable>
        <Pressable onPress={() => setPicker(picker === "time" ? null : "time")} style={[s.input, s.half]}>
          <Icon name="clock-outline" size={17} color={C.muted} />
          <Text style={[s.pickText, !value.time && s.placeholder]} numberOfLines={1}>
            {timeLabel}
          </Text>
        </Pressable>
      </View>

      {picker && (
        <DateTimePicker
          value={(picker === "date" ? value.date : value.time) || (child ? new Date() : new Date(1995, 0, 1, 12, 0))}
          mode={picker}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          maximumDate={picker === "date" ? new Date() : undefined}
          onChange={onPicked}
        />
      )}
      {picker && Platform.OS === "ios" && (
        <Pressable onPress={() => setPicker(null)} style={s.doneButton}>
          <Text style={s.doneText}>{t("common.done")}</Text>
        </Pressable>
      )}

      <View style={[s.input, s.placeInput]}>
        <Icon name="map-marker-outline" size={17} color={C.muted} />
        <TextInput
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            if (value.place) set({ place: null });
          }}
          placeholder={t("reports.partner.birthPlace")}
          placeholderTextColor={C.muted}
          style={s.placeText}
        />
        {searching && <ActivityIndicator size="small" color={C.plum} />}
        {!!value.place && <Icon name="check-circle" size={18} color="#2E7D4F" />}
      </View>

      {!value.place && results.length > 0 && (
        <View style={s.results}>
          {results.map((place, i) => (
            <Pressable
              key={`${place.name}-${place.latitude}-${i}`}
              onPress={() => {
                set({ place });
                setQuery(place.name);
                setResults([]);
              }}
              style={[s.result, i > 0 && s.resultLine]}
            >
              <Text style={s.resultName}>{place.name}</Text>
              <Text style={s.resultSub} numberOfLines={1}>
                {[place.admin1, place.country].filter(Boolean).join(", ")}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginTop: 14, gap: 10 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  label: { color: C.muted, fontSize: 14 },
  row: { flexDirection: "row", gap: 10 },
  input: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.card,
    paddingHorizontal: 12,
    color: C.ink,
    fontSize: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  half: { flex: 1 },
  pickText: { color: C.ink, fontSize: 15 },
  placeholder: { color: C.muted },
  chip: { flex: 1, height: 42, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, alignItems: "center", justifyContent: "center" },
  chipOn: { backgroundColor: C.plum, borderColor: C.plum },
  chipText: { color: C.ink, fontSize: 15, fontWeight: "600" },
  chipTextOn: { color: C.card },
  doneButton: { alignSelf: "flex-end", paddingHorizontal: 14, paddingVertical: 6 },
  doneText: { color: C.plum, fontSize: 15, fontWeight: "700" },
  placeInput: { paddingRight: 10 },
  placeText: { flex: 1, color: C.ink, fontSize: 15, paddingVertical: 10 },
  results: { borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, overflow: "hidden" },
  result: { paddingHorizontal: 12, paddingVertical: 10 },
  resultLine: { borderTopWidth: 1, borderTopColor: C.line },
  resultName: { color: C.ink, fontSize: 15, fontWeight: "600" },
  resultSub: { color: C.muted, fontSize: 13, marginTop: 2 },
});
