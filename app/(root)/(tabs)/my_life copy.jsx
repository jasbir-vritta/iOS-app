import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUserStore } from "../../../components/stores/userStore";

const API_URL = "http://172.20.10.5:8000"; // your backend (use an env var for release builds)
const STORAGE_KEY = "user_birth_details";

const NAVY = "#070C1C", BEIGE = "#EDE5DA", BROWN = "#8F3E08", INK = "#1B1B1F";
const MUTED = "#A7ACBC", CARD = "#FAFAF8", LINE = "#DFD5C7";

const TAB = {
  Past: { icon: "🌱", bg: "#15341A", on: "#1F4A22", line: "#8CF08C" },
  Today: { icon: "🪷", bg: "#16226B", on: "#2C47B0", line: "#6D8DFF" },
  Future: { icon: "🐚", bg: "#22104F", on: "#3A1D7A", line: "#D6B8FF" },
};
const STATUS_COLOR = { Favourable: "#2F8F3A", Neutral: "#D9822B", Challenging: "#E0523F" };
const STATUS_BG = { Favourable: "#E3F2E1", Neutral: "#FBF1D6", Challenging: "#FBE4E1" };
const SLOT_COLOR = { Favourable: "#4CAF50", Neutral: "#7C808D", Avoid: "#D95F52" };
const SLOT_LABEL = { Favourable: "#6FD07B", Neutral: "#C9CBD4", Avoid: "#E8776B" };
const AREAS = [
  { key: "love", label: "Love", icon: "👫" },
  { key: "career", label: "Career", icon: "💼" },
  { key: "money", label: "Money", icon: "💰" },
  { key: "health", label: "Health", icon: "🛡️" },
];
const LUCKY = {
  1: ["Golden", "#D4A017"], 2: ["Pearl White", "#E8DFC9"], 3: ["Yellow", "#E6C229"],
  4: ["Steel Blue", "#4682B4"], 5: ["Green", "#3CB371"], 6: ["Pink", "#F0A3BF"],
  7: ["Sea Green", "#2E8B57"], 8: ["Navy", "#2B3F8F"], 9: ["Red", "#C0392B"],
};
const NUMBER_WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
const GLYPH = {
  aries: "♈", taurus: "♉", gemini: "♊", cancer: "♋", leo: "♌", virgo: "♍",
  libra: "♎", scorpio: "♏", sagittarius: "♐", capricorn: "♑", aquarius: "♒", pisces: "♓",
};
const STAGE_ICONS = ["🪴", "🌿", "🌷", "💐", "🌳", "🌸"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* -------------------------------- helpers -------------------------------- */

const toText = (v) => {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.replace(/\\'/g, "'").trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(toText).filter(Boolean).join("\n");
  if (typeof v === "object") return toText(v.tithi_name ?? v.details ?? v.description ?? v.prediction ?? v.text ?? v.name ?? v.title);
  return "";
};
const toList = (v) => (!v ? [] : Array.isArray(v) ? v.map(toText).filter(Boolean) : toText(v).split("\n").filter(Boolean));
const normStatus = (v) => {
  const s = toText(v).toLowerCase();
  return /challeng|avoid|unfavo|difficult|bad|negative/.test(s) ? "Challenging" : /favo|good|excellent|positive|great/.test(s) ? "Favourable" : "Neutral";
};
const normSlot = (v) => {
  const s = normStatus(v);
  return s === "Challenging" ? "Avoid" : s;
};
const fmtShort = (iso) => {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} '${m[1].slice(2)}` : toText(iso);
};
const parseDate = (v) => {
  const m = String(v || "").match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
};
const ageAt = (birth, d) => Math.max(0, Math.floor((d - birth) / (365.2425 * 86400000)));
const ageLabel = (item, birth) => {
  const s = parseDate(item?.start), e = parseDate(item?.end);
  if (!birth || !s) return "";
  const cap = e && e > new Date() ? new Date() : e;
  return cap ? `${ageAt(birth, s)}-${ageAt(birth, cap)} yrs old` : `${ageAt(birth, s)}+ yrs old`;
};
const reduceDigit = (n) => { let v = Math.abs(n); while (v > 9) v = String(v).split("").reduce((a, c) => a + +c, 0); return v; };

function getZodiacSign(day, month) {
  const d = [20, 19, 21, 20, 21, 21, 23, 23, 23, 23, 22, 22];
  const names = ["capricorn", "aquarius", "pisces", "aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn"];
  return names[day < d[month - 1] ? month - 1 : month];
}

function areaDetail(label, value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { status: normStatus(value.status), title: toText(value.title) || `${label} today`, text: toText(value.description ?? value.text) || "No information available for today." };
  }
  return { status: "Neutral", title: `${label} today`, text: toText(value) || "No information available for today." };
}

function buildSlots(raw) {
  if (Array.isArray(raw) && raw.length) {
    const idx = raw.findIndex((s) => s?.current === true);
    const p = Number(raw[idx]?.progress);
    return {
      slots: raw.map((s) => ({ time: toText(s.time), status: normSlot(s.status) })),
      current: idx >= 0 ? idx : 0,
      fraction: Number.isFinite(p) ? Math.min(0.98, Math.max(0.02, p)) : 0.5,
    };
  }
  const now = new Date(), anchor = new Date(now);
  anchor.setMinutes(0, 0, 0);
  const fmt = (d) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return {
    slots: Array.from({ length: 12 }, (_, i) => ({ time: fmt(new Date(anchor.getTime() + i * 3600000)), status: "Neutral" })),
    current: 0,
    fraction: Math.min(0.98, Math.max(0.02, (now - anchor) / 3600000)),
  };
}

const openChat = (q) => router.push(q ? { pathname: "/chat", params: { q } } : "/chat");

/* --------------------------------- screen -------------------------------- */

export default function MyLife() {
  const { user } = useUserStore();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState("Today");
  const [mylife, setMylife] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedArea, setSelectedArea] = useState("career");
  const [chatInput, setChatInput] = useState("");

  useEffect(() => { loadMyLife(); }, []);

  const loadMyLife = async () => {
    try {
      setLoading(true);
      setError("");

      let saved = user;
      if (!saved?.dateOfBirth || !saved?.timeOfBirth) {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) saved = JSON.parse(stored);
      }
      if (!saved?.dateOfBirth || !saved?.timeOfBirth) return setError("Please save your birth details first.");

      const dp = saved.dateOfBirth.split("/"), tp = saved.timeOfBirth.split(":");
      if (dp.length !== 3 || tp.length < 2) return setError("Invalid birth date or birth time.");

      const [day, month, year] = dp.map(Number);
      const [hour, min] = tp.map(Number);
      const lat = Number(saved.lat), lon = Number(saved.lon);

      let timezone = Number(saved.tzone);
      if (!Number.isFinite(timezone)) {
        const map = {
          "Asia/Kolkata": 5.5, "Asia/Calcutta": 5.5, "Asia/Dubai": 4, "Asia/Singapore": 8, "Asia/Tokyo": 9,
          "Europe/London": 0, "Europe/Paris": 1, "America/New_York": -5, "America/Chicago": -6,
          "America/Denver": -7, "America/Los_Angeles": -8,
        };
        timezone = map[saved.tzone];
      }
      if (![day, month, year, hour, min, lat, lon, timezone].every(Number.isFinite)) return setError("Invalid birth details.");

      setProfile({ ...saved, day, month, year, hour, min, lat, lon, timezone });

      const response = await fetch(`${API_URL}/astrology/mylife`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          day, month, year, hour, min, lat, lon, tzone: timezone,
          zodiac_name: getZodiacSign(day, month),
          language: saved.language || "en",
          name: saved.name || "User",
        }),
      });
      const text = await response.text();
      let data = null;
      try { data = JSON.parse(text); } catch { data = null; }
      if (!response.ok) throw new Error(data?.detail || `My Life API failed with status ${response.status}`);
      setMylife(data);
    } catch (err) {
      console.error("MY LIFE ERROR:", err);
      setError(err?.message || "Unable to load My Life. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const today = mylife?.today || {};
  const birth = useMemo(() => (profile ? new Date(profile.year, profile.month - 1, profile.day) : null), [profile]);
  const areaDetails = AREAS.map((a) => ({ ...a, ...areaDetail(a.label, today.life_areas?.[a.key]) }));

  const handleShare = async () => {
    try {
      await Share.share({
        message: ["MyLife", profile?.name && `Name: ${profile.name}`, profile?.dateOfBirth && `DOB: ${profile.dateOfBirth}`,
          today.moon_sign && `Moon Sign: ${today.moon_sign}`, today.tithi && `Tithi: ${toText(today.tithi)}`].filter(Boolean).join("\n"),
      });
    } catch (e) { console.log("SHARE ERROR:", e); }
  };

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: BEIGE }]}>
        <ActivityIndicator size="large" color={BROWN} />
        <Text style={{ marginTop: 14, color: "#777" }}>Preparing your My Life...</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={[s.center, { backgroundColor: BEIGE, paddingHorizontal: 30 }]}>
        <Text style={{ fontSize: 22, fontWeight: "700", color: NAVY, marginBottom: 10 }}>Unable to load My Life</Text>
        <Text style={{ fontSize: 15, lineHeight: 22, color: "#777", textAlign: "center", marginBottom: 24 }}>{error}</Text>
        <Pressable style={{ backgroundColor: BROWN, paddingHorizontal: 26, paddingVertical: 13, borderRadius: 25 }} onPress={loadMyLife}>
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: activeTab === "Today" ? BEIGE : NAVY }}>
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable style={s.hBtn} onPress={() => router.back()}><Text style={{ color: "#fff", fontSize: 34, fontWeight: "300" }}>‹</Text></Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>MyLife</Text>
          <Text style={{ color: MUTED, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
            DOB: {profile?.dateOfBirth}  |  POB: {String(profile?.placeOfBirth || "Birth place").toUpperCase()}
          </Text>
        </View>
        <Pressable style={s.hBtn} onPress={() => Alert.alert("MyLife", "Your insights are generated from your birth details and astrology data.")}>
          <Text style={{ color: "#fff", fontSize: 20 }}>ⓘ</Text>
        </Pressable>
        <Pressable style={s.hBtn} onPress={handleShare}><Text style={{ color: "#fff", fontSize: 20 }}>↗</Text></Pressable>
      </View>

      <TabBar active={activeTab} onChange={setActiveTab} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        {activeTab === "Today" && (
          <TodayView
            today={today} profile={profile} areaDetails={areaDetails}
            selectedArea={selectedArea} setSelectedArea={setSelectedArea}
            chatInput={chatInput} setChatInput={setChatInput}
            onFuture={() => setActiveTab("Future")}
          />
        )}

        {activeTab === "Past" && (
          <TimelineList
            tone="past" title="This is your past, explained."
            subtitle="Your kundli and dasha have revealed important past events from your life. Explore them one by one"
            startIcon="🌱" startKicker={`In ${profile?.year ?? ""},`} startText="You were born"
            rows={mylife?.past?.timeline} birth={birth} empty="Past timeline information is unavailable."
          />
        )}

        {activeTab === "Future" && (
          <>
            {mylife?.future?.phase && (
              <PhaseView phase={mylife.future.phase} initialArea={selectedArea} />
            )}
            <TimelineList
              tone="future" title="Your future, explained."
              subtitle="These upcoming phases are based on your kundli and dasha. Explore them one by one"
              startIcon="🪷" startKicker="Today," startText="You are here"
              rows={mylife?.future?.timeline} birth={birth} empty="Future timeline information is unavailable."
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

/* ---------------------------------- tabs --------------------------------- */

function TabBar({ active, onChange }) {
  return (
    <View style={{ flexDirection: "row", backgroundColor: NAVY, paddingTop: 6, borderBottomWidth: 1.5, borderBottomColor: TAB[active].line }}>
      {Object.keys(TAB).map((t) => (
        <Pressable
          key={t} onPress={() => onChange(t)}
          style={[s.tab, { backgroundColor: t === active ? TAB[t].on : TAB[t].bg, borderColor: t === active ? TAB[t].line : "transparent" }]}
        >
          <Text style={{ fontSize: 20 }}>{TAB[t].icon}</Text>
          <Text style={{ color: t === active ? "#fff" : "rgba(255,255,255,0.55)", fontSize: 16, fontWeight: "600", marginLeft: 6 }}>{t}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/* ---------------------------------- today -------------------------------- */

function TodayView({ today, profile, areaDetails, selectedArea, setSelectedArea, chatInput, setChatInput, onFuture }) {
  const moonSign = toText(today.moon_sign);
  const tithi = toText(today.tithi);
  const timing = useMemo(() => buildSlots(today.timing), [today.timing]);
  const cur = timing.slots[timing.current];
  const mood = cur?.status === "Avoid" ? "☹️" : cur?.status === "Favourable" ? "🙂" : "😐";
  const selected = areaDetails.find((a) => a.key === selectedArea) || areaDetails[1];
  const careerStatus = areaDetails.find((a) => a.key === "career")?.status;

  const lucky = useMemo(() => {
    const now = new Date();
    const fb = reduceDigit(now.getDate() + now.getMonth() + 1 + now.getFullYear() + (profile?.day || 0)) || 1;
    const raw = Number(String(today.lucky_number ?? "").split(",")[0]);
    const n = Number.isFinite(raw) && raw >= 1 && raw <= 9 ? raw : fb;
    const byNum = LUCKY[n] || LUCKY[4];
    const name = toText(today.lucky_colour);
    const hit = Object.values(LUCKY).find((c) => c[0].toLowerCase() === name.toLowerCase());
    return { n, word: NUMBER_WORDS[n], name: name || byNum[0], hex: hit ? hit[1] : byNum[1] };
  }, [today.lucky_number, today.lucky_colour, profile?.day]);

  const dos = toList(today.guidance?.dos), donts = toList(today.guidance?.donts);
  const dateLabel = (toText(today.date) || new Date().toDateString()).toUpperCase();

  const tasks = [
    { eyebrow: "AAJ KA MANTRA", title: "Ganesha Mantra", tag: "for Career", cta: "Start", bg: "#34456E",
      text: careerStatus === "Challenging" ? "Career has obstacles today; Ganesha will clear the path" : "Start the day with a steady mind; Ganesha backs new beginnings" },
    { eyebrow: "DAILY CHECK-IN", title: "Daily Check-in", tag: "Reward: Streak bonus", bg: "#1F3355",
      text: "Complete today's tasks to keep your streak going" },
  ];

  return (
    <View>
      {/* dark hero */}
      <View style={{ backgroundColor: NAVY, paddingHorizontal: 16, paddingTop: 22, paddingBottom: 44 }}>
        <Text style={{ color: "#C9CBD4", textAlign: "center", fontSize: 13, fontWeight: "700", letterSpacing: 3 }}>{dateLabel}</Text>
        {!!tithi && (
          <View style={s.tithi}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "#8A8A8A", marginRight: 8 }} />
            <Text style={{ color: "rgba(255,255,255,0.7)", fontWeight: "500", fontSize: 13, letterSpacing: 2 }}>TITHI: </Text>
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13, letterSpacing: 2 }}>{tithi.toUpperCase()}</Text>
          </View>
        )}

        <View style={{ marginTop: 22 }}>
          <View style={s.moonBadge}>
            <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: "#B5509F", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 30, color: "#fff" }}>{GLYPH[moonSign.toLowerCase()] || "☾"}</Text>
            </View>
          </View>
          <View style={s.heroCard}>
            <Text style={{ color: MUTED, textAlign: "center", fontSize: 13 }}>☾ Moon sign</Text>
            <Text style={{ color: "#fff", textAlign: "center", fontSize: 24, fontStyle: "italic" }}>{moonSign || "—"}</Text>
            <Text style={{ color: "#E08A3C", textAlign: "center", fontSize: 15, fontWeight: "700", letterSpacing: 2, marginTop: 18 }}>TODAY'S HOROSCOPE</Text>
            <Text style={{ color: "#fff", textAlign: "center", fontSize: 24, fontWeight: "600", marginTop: 12 }}>
              {toText(today.horoscope_title) || "Your day at a glance"}
            </Text>
            <Text style={{ color: "#C9CBD4", textAlign: "center", fontSize: 16, lineHeight: 25, marginTop: 12 }}>
              {toText(today.horoscope_text) || "Today's horoscope is unavailable right now."}
            </Text>
            <View style={s.luckyRow}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={s.luckyNum}><Text style={{ color: "#fff", fontSize: 18, fontWeight: "600" }}>{lucky.n}</Text></View>
                <View style={{ marginLeft: 10 }}>
                  <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>{lucky.word}</Text>
                  <Text style={{ color: MUTED, fontSize: 12 }}>Lucky Number</Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: lucky.hex }} />
                <View style={{ marginLeft: 10 }}>
                  <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>{lucky.name}</Text>
                  <Text style={{ color: MUTED, fontSize: 12 }}>Lucky Colour</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={{ marginTop: 28 }}>
          <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>Today Timing for you</Text>
          <Text style={{ color: MUTED, fontSize: 14, marginTop: 2 }}>Based on your birth chart</Text>
          <Text style={s.mood}>{mood}</Text>
        </View>
        <TimingStrip timing={timing} />
      </View>

      {/* beige body */}
      <View style={{ backgroundColor: BEIGE, marginTop: -22, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 16, paddingTop: 24 }}>
        <Text style={s.h2}>Life area events based on phase</Text>
        <AreaChips items={areaDetails} selected={selected.key} onSelect={setSelectedArea} />

        <View style={s.card}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={{ fontSize: 34 }}>{selected.icon}</Text>
            <Text style={{ flex: 1, marginLeft: 12, fontSize: 18, fontWeight: "700", color: INK }}>{selected.title}</Text>
          </View>
          <Text style={{ marginTop: 14, fontSize: 15, lineHeight: 22, color: "#4A4A52" }}>{selected.text}</Text>
          <Pressable onPress={onFuture} style={s.futureBtn}>
            <Text style={{ fontSize: 32 }}>🪐</Text>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ fontSize: 13, color: INK }}>Check out the future</Text>
              <Text style={{ fontSize: 17, fontWeight: "700", color: INK }}>{selected.label} in your dasha</Text>
            </View>
            <Text style={{ fontSize: 22, color: INK }}>›</Text>
          </Pressable>
        </View>

        <Text style={[s.h2, { marginTop: 28, fontSize: 21 }]}>Today's Tasks</Text>
        <Text style={{ fontSize: 15, color: "#55555C", marginBottom: 12 }}>Do these today for best results</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
          {tasks.map((t) => (
            <View key={t.title} style={s.taskCard}>
              <View style={{ backgroundColor: t.bg, padding: 18 }}>
                <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, letterSpacing: 1 }}>{t.eyebrow}</Text>
                <Text style={{ color: "#fff", fontSize: 20, fontWeight: "600", marginTop: 2 }}>{t.title}</Text>
                <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 15, lineHeight: 21, marginTop: 12 }}>{t.text}</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14 }}>
                <Text style={{ fontSize: 15, color: "#55555C" }}>{t.tag}</Text>
                {!!t.cta && <View style={s.pillBtn}><Text style={{ fontSize: 15, fontWeight: "700", color: INK }}>{t.cta} ›</Text></View>}
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={[s.card, { marginTop: 28, backgroundColor: "#F6F3EE" }]}>
          <Text style={{ fontSize: 19, fontWeight: "700", color: INK }}>☑  Today's Guidance</Text>
          <View style={s.dashed}>
            {dos.map((d, i) => (
              <View key={i} style={s.gRow}><Text style={{ color: "#3E9B3E", fontSize: 18, fontWeight: "900" }}>✓</Text><Text style={s.gText}>{d}</Text></View>
            ))}
          </View>
          <View style={s.dashed}>
            {donts.map((d, i) => (
              <View key={i} style={s.gRow}><Text style={{ color: "#E04B4B", fontSize: 18, fontWeight: "900" }}>✕</Text><Text style={s.gText}>{d}</Text></View>
            ))}
          </View>
          <AskBox value={chatInput} onChange={setChatInput} />
        </View>
      </View>
    </View>
  );
}

function TimingStrip({ timing }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 22, marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16 }}>
      {timing.slots.map((slot, i) => (
        <View key={i} style={{ width: 64, marginRight: 3 }}>
          <Text style={{ color: SLOT_LABEL[slot.status], fontSize: 12, fontWeight: "600" }}>{slot.status} ›</Text>
          <View style={{ marginTop: 8, height: 8 }}>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: SLOT_COLOR[slot.status] }} />
            {i === timing.current && (
              <View style={{
                position: "absolute", top: -8, left: `${timing.fraction * 100}%`, marginLeft: -12, width: 24, height: 24, borderRadius: 12,
                backgroundColor: slot.status === "Favourable" ? SLOT_COLOR.Favourable : SLOT_COLOR.Avoid,
                borderWidth: 4, borderColor: "rgba(255,255,255,0.3)",
              }} />
            )}
          </View>
          <View style={{ width: 1, height: 18, backgroundColor: "#4A5068", marginTop: 8 }} />
          <Text style={{ color: "#C9CBD4", fontSize: 12, marginTop: 4 }}>{slot.time}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function AreaChips({ items, selected, onSelect }) {
  return (
    <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
      {items.map((a) => {
        const on = a.key === selected;
        return (
          <Pressable key={a.key} onPress={() => onSelect(a.key)} style={[s.chip, on && { borderColor: "#7A3A12", backgroundColor: "#D6C3B4" }]}>
            <Text style={{ fontSize: 38, opacity: on ? 1 : 0.6 }}>{a.icon}</Text>
            <Text style={{ marginTop: 6, fontSize: 15, fontWeight: "600", color: INK }}>{a.label}</Text>
            <Text style={{ marginTop: 2, fontSize: 11.5, fontWeight: "500", color: STATUS_COLOR[a.status] }}>{a.status}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function AskBox({ value, onChange }) {
  return (
    <View style={{ marginTop: 20, backgroundColor: "#DED3C5", borderRadius: 24, padding: 10 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 8, paddingBottom: 8 }}>
        <Text style={{ color: "#2F8F3A", fontWeight: "600", fontSize: 15 }}>Sign-up Reward: 1min</Text>
        <Text style={{ fontWeight: "700", color: INK }}>FREE</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#F3EEE7", borderRadius: 40, padding: 6 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#E3D3BE", alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 24 }}>🧘</Text></View>
        <TextInput
          value={value} onChangeText={onChange} placeholder="When will I get a job?" placeholderTextColor="#9A958D"
          onSubmitEditing={() => openChat(value.trim())} returnKeyType="send"
          style={{ flex: 1, paddingHorizontal: 10, fontSize: 16, color: INK }}
        />
        <Pressable onPress={() => openChat(value.trim())} style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: "#7A3512", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "#fff", fontSize: 18 }}>➤</Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ----------------------------- past / future ----------------------------- */

function TimelineList({ tone, title, subtitle, startIcon, startKicker, startText, rows, birth, empty }) {
  const [open, setOpen] = useState(null);
  const list = (rows || []).map((r) => ({
    age: ageLabel(r, birth), title: toText(r.title) || "Life phase", detail: toText(r.description),
    period: r.start && r.end ? `${r.start} → ${r.end}` : "",
  }));
  const line = tone === "past" ? "#B9B7C7" : "#C9AEF2";

  return (
    <View style={{ paddingHorizontal: 22, paddingTop: 26, backgroundColor: NAVY }}>
      <Text style={{ color: BEIGE, fontSize: 26, fontWeight: "700", lineHeight: 32 }}>{title}</Text>
      <Text style={{ color: "#B4B1AA", fontSize: 16, lineHeight: 23, marginTop: 10 }}>{subtitle}</Text>

      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 24, marginBottom: 6 }}>
        <Text style={{ fontSize: 40 }}>{startIcon}</Text>
        <View style={{ marginLeft: 10 }}>
          <Text style={{ color: "#A8A39B", fontSize: 13 }}>{startKicker}</Text>
          <Text style={{ color: BEIGE, fontSize: 20, fontWeight: "500" }}>{startText}</Text>
        </View>
      </View>

      {list.length === 0 && (
        <View style={{ backgroundColor: "#1A1C2B", borderRadius: 24, padding: 18, marginTop: 12 }}>
          <Text style={{ color: "#B4B1AA", fontSize: 15, lineHeight: 22 }}>{empty}</Text>
        </View>
      )}

      {list.map((r, i) => (
        <View key={i} style={{ flexDirection: "row" }}>
          <View style={{ width: 34, alignItems: "center" }}>
            <View style={{ width: 1.5, height: 14, backgroundColor: line }} />
            <Text style={{ fontSize: 26 }}>{STAGE_ICONS[i % STAGE_ICONS.length]}</Text>
            {i < list.length - 1 && <View style={{ width: 1.5, flex: 1, backgroundColor: line }} />}
          </View>
          <View style={{ flex: 1, paddingBottom: 16, paddingLeft: 8 }}>
            <Text style={{ marginTop: 14 }}>
              <Text style={{ color: "#A8A39B", fontSize: 12 }}>During </Text>
              <Text style={{ color: BEIGE, fontSize: 17, fontWeight: "500" }}>{r.age}</Text>
            </Text>
            <Pressable onPress={() => setOpen(open === i ? null : i)} style={{ backgroundColor: "#1A1C2B", borderRadius: 24, padding: 18, marginTop: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={{ flex: 1, color: BEIGE, fontSize: 18, fontWeight: "500", lineHeight: 24 }}>{r.title}</Text>
                <Text style={{ color: BEIGE, fontSize: 20, transform: [{ rotate: open === i ? "90deg" : "0deg" }] }}>›</Text>
              </View>
              {open === i && (
                <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)" }}>
                  {!!r.period && <Text style={{ color: "#A8A39B", fontSize: 13 }}>{r.period}</Text>}
                  {!!r.detail && <Text style={{ color: "#CFCAC1", fontSize: 15, lineHeight: 23, marginTop: 8 }}>{r.detail}</Text>}
                </View>
              )}
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

/* ---------------------------- future: phase view -------------------------- */

function PhaseView({ phase, initialArea }) {
  const [area, setArea] = useState(AREAS.some((a) => a.key === initialArea) ? initialArea : "career");
  const [answers, setAnswers] = useState({});
  const [card, setCard] = useState(0);

  const items = AREAS.map((a) => ({ ...a, status: normStatus(phase.areas?.[a.key]?.status), events: phase.areas?.[a.key]?.events || [] }));
  const sel = items.find((a) => a.key === area) || items[1];
  const others = items.filter((a) => a.key !== sel.key);
  const reflections = phase.reflections || [];

  return (
    <View style={{ backgroundColor: BEIGE, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 28 }}>
      {phase.ahead?.length > 0 && (
        <View style={s.card}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: "#F4B25E", alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 22 }}>📅</Text></View>
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: "700", color: INK }}>Ahead in this Phase</Text>
              <Text style={{ fontSize: 12.5, color: "#6A6A70" }}>Key events you may experience next in this dasha</Text>
            </View>
          </View>
          <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: LINE }}>
            {phase.ahead.map((t, i) => (
              <View key={i} style={{ flexDirection: "row", marginBottom: 12 }}>
                <Text style={{ marginRight: 10, color: INK }}>✦</Text>
                <Text style={{ flex: 1, fontSize: 16, lineHeight: 22, color: INK }}>{t}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <Text style={[s.h2, { marginTop: 26 }]}>Life area events based on phase</Text>
      <AreaChips items={items} selected={sel.key} onSelect={setArea} />

      <View style={[s.card, { marginTop: 16, backgroundColor: "#F6F3EE" }]}>
        <Text style={{ fontSize: 17, fontWeight: "600", color: INK, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: LINE }}>
          🗓  Likely events in {sel.label}
        </Text>
        <View style={{ marginTop: 14 }}>
          {sel.events.map((e, i) => {
            const current = e.state === "current", past = e.state === "past";
            return (
              <View key={i} style={{ flexDirection: "row" }}>
                <View style={{ width: 30, alignItems: "center" }}>
                  {past || current
                    ? <Text style={{ fontSize: 20, opacity: past ? 0.5 : 1 }}>{sel.icon}</Text>
                    : <View style={{ width: 14, height: 14, marginTop: 4, borderRadius: 7, borderWidth: 2, borderColor: BROWN, backgroundColor: "#F6F3EE" }} />}
                  {i < sel.events.length - 1 && <View style={{ width: 2, flex: 1, backgroundColor: "rgba(143,62,8,0.7)", marginTop: 4 }} />}
                </View>
                <View style={{ flex: 1, paddingLeft: 8, paddingBottom: 18 }}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text style={{ fontSize: 14, color: "#55555C" }}>{fmtShort(e.start)} - {fmtShort(e.end)}</Text>
                    {current && <Text style={s.currentTag}>CURRENT</Text>}
                  </View>
                  {current ? (
                    <View style={{ marginTop: 8, backgroundColor: "#E6D3C6", borderRadius: 20, padding: 14 }}>
                      <Text style={{ fontSize: 17, fontWeight: "600", color: INK, lineHeight: 23 }}>{e.title}</Text>
                      {!!e.description && <Text style={{ marginTop: 8, fontSize: 15, lineHeight: 22, color: "#3D3D44" }}>{e.description}</Text>}
                      <Pressable
                        onPress={() => openChat(`Tell me more about my ${sel.label.toLowerCase()} from ${fmtShort(e.start)} to ${fmtShort(e.end)}`)}
                        style={{ marginTop: 12, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#D2B8A7", backgroundColor: "#EBDCD1", borderRadius: 16, padding: 12 }}
                      >
                        <Text style={{ flex: 1, color: "#7A3512", fontSize: 15, fontWeight: "500" }}>💬  Need more clarity?</Text>
                        <Text style={{ color: "#7A3512", fontSize: 18 }}>›</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Text style={{ marginTop: 6, fontSize: 17, fontWeight: "600", lineHeight: 23, color: past ? "#8A8A90" : INK }}>{e.title}</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {reflections.length > 0 && (
        <>
          <Text style={[s.h2, { marginTop: 26 }]}>✨ Moments to reflect</Text>
          <ScrollView
            horizontal pagingEnabled={false} snapToInterval={296} decelerationRate="fast" showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -16, marginTop: 14 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
            onScroll={(ev) => setCard(Math.round(ev.nativeEvent.contentOffset.x / 296))} scrollEventThrottle={32}
          >
            {reflections.map((text, i) => (
              <View key={i} style={[s.card, { width: 284, backgroundColor: "#F6F3EE" }]}>
                <Text style={{ fontSize: 18, lineHeight: 25, color: INK }}>{text}</Text>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: LINE }}>
                  {[["Agree", "#E3F2E1", "#CFE8CB", "#2F8F3A"], ["Maybe", "#E4E1DB", "#CFCDC8", INK], ["Disagree", "#FCE9D3", "#F6D4B0", "#B7651F"]].map(([k, bg, bgOn, fg]) => (
                    <Pressable
                      key={k} onPress={() => setAnswers((a) => ({ ...a, [i]: k }))}
                      style={{ flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 30, backgroundColor: answers[i] === k ? bgOn : bg, borderWidth: answers[i] === k ? 1.5 : 0, borderColor: fg }}
                    >
                      <Text style={{ color: fg, fontWeight: "600", fontSize: 14 }}>{k}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 12 }}>
            {reflections.map((_, i) => (
              <View key={i} style={{ height: 6, width: i === card ? 20 : 6, borderRadius: 3, backgroundColor: i === card ? BROWN : "#CFC3B4" }} />
            ))}
          </View>
        </>
      )}

      <Text style={[s.h2, { marginTop: 26 }]}>▦ Explore More</Text>
      <View style={[s.card, { marginTop: 14, paddingVertical: 4, backgroundColor: "#F6F3EE" }]}>
        {others.map((a, i) => (
          <Pressable key={a.key} onPress={() => setArea(a.key)} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, borderTopWidth: i ? 1 : 0, borderTopColor: LINE }}>
            <Text style={{ fontSize: 24 }}>{a.icon}</Text>
            <Text style={{ fontSize: 17, fontWeight: "500", color: INK, marginHorizontal: 12 }}>{a.label}</Text>
            <Text style={{ fontSize: 12, fontWeight: "500", color: STATUS_COLOR[a.status], backgroundColor: STATUS_BG[a.status], paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, overflow: "hidden" }}>{a.status}</Text>
            <Text style={{ marginLeft: "auto", fontSize: 20, color: "#6A6A70" }}>›</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/* --------------------------------- styles -------------------------------- */

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  header: { backgroundColor: NAVY, paddingBottom: 10, paddingHorizontal: 10, flexDirection: "row", alignItems: "center" },
  hBtn: { width: 38, height: 38, justifyContent: "center", alignItems: "center" },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 13, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1.5, borderBottomWidth: 0 },
  tithi: { alignSelf: "center", flexDirection: "row", alignItems: "center", marginTop: 12, backgroundColor: "#D9782B", borderWidth: 2, borderColor: "#E39A55", borderRadius: 30, paddingHorizontal: 16, paddingVertical: 7 },
  moonBadge: { position: "absolute", top: 0, alignSelf: "center", zIndex: 5, width: 96, height: 96, borderRadius: 48, backgroundColor: "#10183A", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  heroCard: { marginTop: 48, borderRadius: 36, borderWidth: 1, borderColor: "#3A3552", backgroundColor: "#0C1330", paddingHorizontal: 22, paddingTop: 62, paddingBottom: 22 },
  luckyRow: { marginTop: 22, paddingTop: 18, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)", flexDirection: "row", justifyContent: "space-around" },
  luckyNum: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  mood: { position: "absolute", right: 0, top: 0, width: 42, height: 42, borderRadius: 21, backgroundColor: "#4A1C26", textAlign: "center", lineHeight: 42, fontSize: 21, overflow: "hidden" },
  h2: { fontSize: 19, fontWeight: "700", color: INK },
  card: { marginTop: 18, backgroundColor: CARD, borderRadius: 26, borderWidth: 1, borderColor: LINE, padding: 18 },
  chip: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 22, borderWidth: 2, borderColor: "transparent", backgroundColor: "#E6DDD0" },
  futureBtn: { marginTop: 18, flexDirection: "row", alignItems: "center", backgroundColor: "#EDE3DB", borderRadius: 16, padding: 12 },
  taskCard: { width: 280, borderRadius: 26, overflow: "hidden", backgroundColor: "#FAF8F5" },
  pillBtn: { backgroundColor: BEIGE, borderRadius: 30, paddingHorizontal: 18, paddingVertical: 10 },
  dashed: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: "#C9BFB1", borderStyle: "dashed" },
  gRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 12 },
  gText: { flex: 1, marginLeft: 12, fontSize: 16, lineHeight: 22, color: INK },
  currentTag: { marginLeft: 8, fontSize: 11, fontWeight: "700", letterSpacing: 0.5, color: BROWN, backgroundColor: "#F1DDD1", borderWidth: 1, borderColor: "#D9B8A4", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, overflow: "hidden" },
});