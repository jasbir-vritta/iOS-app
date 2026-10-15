// app/(root)/(tabs)/profile.tsx

import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import { router } from "expo-router";
import {
    ActivityIndicator,
    Dimensions,
    Image,
    ImageBackground,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { APP_NAME } from "../../../components/constants/app";
import { useMyLifeStore } from "../../../components/stores/myLifeStore";
import useProfilesStore from "../../../components/stores/profilesStore";
import { useUserStore } from "../../../components/stores/userStore";
import { useAvatarUpload } from "../../../components/utils/useAvatarUpload";



import { clearSession } from "../../../lib/auth";

/*
 * Which image goes where (swap here if your files are arranged differently):
 *
 * top    -> header art (moon + stars)
 * mid    -> "Your Astrology Snapshot" card background
 * bottom -> "Loved Ones" card background
 */
const ART = {
  top: require("../../../assets/images/profile/profile_settings_top.png"),
  mid: require("../../../assets/images/profile/profile_settings_mid.png"),
  bottom: require("../../../assets/images/profile/profile_settings_bottom.png"),
};


/* Sizes are measured in pixels of the reference design (853px wide) and scaled to the device. */
const K = Math.min(Dimensions.get("window").width, 430) / 853;

const px = (n: number) => Math.round(n * K * 100) / 100;
const fs = (n: number) => Math.max(9, px(n));

// Locked color system
const C = {
  INK: "#1C1820",
  PLUM: "#2B1A3D",
  TERRACOTTA: "#A94C36",
  GOLD: "#C49A4A",
  LAVENDER: "#F4F0F8",
  IVORY: "#F7F1E8",
  CARD: "#FFFDFC",
  MUTED: "#68616A",
  BORDER: "#D9CEC1",
  LAV_TINT: "#EFE8F7",
  PEACH_TINT: "#FBEBE4",
  SOFT_LINE: "#EEE7F4",
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const TZ: Record<string, number> = {
  "Asia/Kolkata": 5.5,
  "Asia/Calcutta": 5.5,
  "Asia/Dubai": 4,
  "Asia/Singapore": 8,
  "Asia/Tokyo": 9,
  "Europe/London": 0,
  "Europe/Paris": 1,
  "America/New_York": -5,
  "America/Chicago": -6,
  "America/Denver": -7,
  "America/Los_Angeles": -8,
};

const fmtDate = (d?: string) => {
  const p = String(d || "").split("/");

  return p.length === 3 && MONTHS[+p[1] - 1]
    ? `${+p[0]} ${MONTHS[+p[1] - 1]} ${p[2]}`
    : d || "—";
};

const fmtTime = (t?: string) => {
  const [h, m] = String(t || "").split(":").map(Number);

  if (!Number.isFinite(h) || !Number.isFinite(m)) {
    return t || "—";
  }

  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${
    h < 12 ? "AM" : "PM"
  }`;
};



export default function Profile() {
  const insets = useSafeAreaInsets();
  const { user } = useUserStore() as any;
  const profiles = useProfilesStore((state) => state.profiles);



  

const activeProfileId = user?.active_profile_id;

const profile =
  profiles.find((p) => p.profile_id === activeProfileId) || user;

// Same Daily horoscope as My Life and Home; it carries the birth-chart signs.
const today = useMyLifeStore(
  (state) =>
    activeProfileId
      ? state.profiles[activeProfileId]?.daily
      : null
);

const sun = today?.sun_sign || "";
const moon = today?.moon_sign || "";
const asc = today?.ascendant || "";








  // Show the selected profile (TopBar picker); fall back to the account details.
  const name = profile?.name || user?.firstName || "Guest";

  const phone = user?.phoneNumber || user?.phone || "";

  const avatarUrl = profiles.find((p) => p.profile_id === activeProfileId)?.avatar_url;
  const { uploading: uploadingPhoto, pickAndUpload } = useAvatarUpload(activeProfileId);





  const logout = async () => {
    try {
      await clearSession();
    } catch {}

    router.replace("/login");
  };

  const todo = (label: string) => () => console.log("TODO:", label);

  return (
    <View style={{ flex: 1, backgroundColor: C.LAVENDER }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: px(240),
        }}
      >
        {/* ============ HEADER ============ */}

        

        <ImageBackground
          source={ART.top}
          resizeMode="cover"
          style={{
            paddingTop: insets.top + px(14),
            paddingBottom: px(22),
            paddingHorizontal: px(44),
          }}
        >
          <View style={s.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>My Profile</Text>

              <Text style={s.subtitle}>
                Your personal space at {APP_NAME}
              </Text>
            </View>

            <Pressable
              onPress={()=>  router.push("/(root)/profile/edit_profile")}
              style={s.editBtn}
            >
              <Icon
                name="pencil-outline"
                size={px(32)}
                color="#fff"
              />

              <Text style={s.editText}>Edit Profile</Text>
            </Pressable>
          </View>

          <View style={s.profileRow}>
            <View style={s.avatar}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={s.avatarImage} />
              ) : (
                <Text style={s.avatarLetter}>
                  {String(name).charAt(0).toUpperCase()}
                </Text>
              )}

              {uploadingPhoto && (
                <View style={s.avatarOverlay}>
                  <ActivityIndicator color="#fff" />
                </View>
              )}

              <Pressable
                onPress={pickAndUpload}
                disabled={uploadingPhoto || !activeProfileId}
                style={s.camera}
              >
                <Icon
                  name="camera-outline"
                  size={px(28)}
                  color="#fff"
                />
              </Pressable>
            </View>

            <View style={s.info}>
              <Text
                style={s.name}
                numberOfLines={1}
              >
                {name}
              </Text>

              {!!phone && (
                <Text
                  style={s.phone}
                  numberOfLines={1}
                >
                  {phone}
                </Text>
              )}



              <View style={s.placeRow}>
                <Icon
                  name="map-marker-outline"
                  size={px(32)}
                  color={C.TERRACOTTA}
                />

                <Text
                  style={s.place}
                  numberOfLines={1}
                >
                  {profile?.placeOfBirth || "Birth place"}
                </Text>
              </View>
            </View>

            <View style={s.vDivider} />

            <View style={s.birthCol}>
              <View style={s.birthCard}>
                <Icon
                  name="calendar-month-outline"
                  size={px(38)}
                  color={C.TERRACOTTA}
                />

                <View
                  style={{
                    marginLeft: px(16),
                    flex: 1,
                  }}
                >
                  <Text
                    style={s.birthValue}
                    numberOfLines={1}
                  >
                    {fmtDate(profile?.dateOfBirth)}
                  </Text>

                  <Text style={s.birthLabel}>
                    Date of Birth
                  </Text>
                </View>
              </View>

              <View
                style={[
                  s.birthCard,
                  {
                    marginTop: px(11),
                  },
                ]}
              >
                <Icon
                  name="clock-outline"
                  size={px(38)}
                  color={C.TERRACOTTA}
                />

                <View
                  style={{
                    marginLeft: px(16),
                    flex: 1,
                  }}
                >
                  <Text
                    style={s.birthValue}
                    numberOfLines={1}
                  >
                    {fmtTime(profile?.timeOfBirth)}
                  </Text>

                  <Text style={s.birthLabel}>
                    Birth Time
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </ImageBackground>

        <View
          style={{
            paddingHorizontal: px(36),
          }}
        >
          {/* ============ ASTROLOGY SNAPSHOT ============ */}

          <ImageBackground
            source={ART.mid}
            resizeMode="cover"
            imageStyle={{
              borderRadius: px(26),
            }}
            style={s.snapshot}
          >
            <Text style={s.cardTitle}>
              Your Astrology Snapshot
            </Text>

            <Text style={s.cardSub}>
              Your core astrological details
            </Text>

            <View style={s.signRow}>
              <SignTile
  icon="white-balance-sunny"
  tint="#FBEBE4"
  color={C.TERRACOTTA}
  label="Sun Sign"
  value={sun || "—"}
/>

              <SignTile
                icon="moon-waning-crescent"
                tint={C.LAV_TINT}
                color={C.PLUM}
                label="Moon Sign"
                value={moon || "—"}
              />

              <SignTile
                icon="arrow-up"
                tint="#FBEBE4"
                color={C.TERRACOTTA}
                label="Ascendant"
                value={asc || "—"}
              />
            </View>
          </ImageBackground>

          {/* ============ LOVED ONES ============ */}

          <ImageBackground
            source={ART.bottom}
            resizeMode="cover"
            imageStyle={{
              borderRadius: px(26),
            }}
            style={s.loved}
          >
            <Text style={s.lovedTitle}>
              Loved Ones
            </Text>

            <Text style={s.lovedText}>
              Add family and friends to get their Kundli
              insights and timely updates.
            </Text>

            <Pressable
              onPress={()=>router.push("/profile/add-profile")}
              style={s.lovedBtn}
            >
              <Text style={s.lovedBtnText}>
                Add Loved Ones
              </Text>

              <Icon
                name="arrow-right"
                size={px(34)}
                color="#fff"
                style={{
                  marginLeft: px(14),
                }}
              />
            </Pressable>
          </ImageBackground>

          {/* ============ QUICK ACCESS ============ */}

          <View style={s.panel}>
            <Text style={s.panelTitle}>
              Quick Access
            </Text>

            <Text style={s.panelSub}>
              Manage your account and preferences
            </Text>

            <View style={s.quickGrid}>
              <QuickTile
                icon="account-multiple-outline"
                tint={C.LAV_TINT}
                color={C.PLUM}
                title="Manage Profiles"
                sub={"Switch or edit\nyour saved profiles."}
                onPress={()=>router.replace("/(root)/profile/manage-profiles")}
              />

              <QuickTile
                icon="translate"
                tint={C.LAV_TINT}
                color={C.PLUM}
                title="Language"
                sub={"Available languages:\nहिंदी, English, Hinglish +4"}
                onPress={()=>router.replace("/(root)/profile/language")}
              />

              <QuickTile
                icon="chat-processing-outline"
                tint={C.PEACH_TINT}
                color={C.TERRACOTTA}
                title="Chat History"
                sub={"View your past\nconversations."}
                onPress={()=>router.replace("/(root)/profile/chat-history")}
              />

              <QuickTile
                icon="wallet-outline"
                tint={C.PEACH_TINT}
                color={C.TERRACOTTA}
                title="Transaction History"
                sub={"View your payments\nand consultations."}
                onPress={()=>router.replace("/(root)/profile/transaction-history")}
              />
            </View>
          </View>

          {/* ============ ACCOUNT & SUPPORT ============ */}

          <View style={s.panel}>
            <Text style={s.panelTitle}>
              Account & Support
            </Text>

            <Text style={s.panelSub}>
              Everything you need in one place
            </Text>

            <View style={s.list}>
              <ListRow
                icon="comment-question-outline"
                tint={C.LAV_TINT}
                color={C.PLUM}
                title="FAQ"
                sub="User questions and answers."
                onPress={() => router.push("/(root)/profile/faq")}
              />

              <ListRow
                icon="help-circle-outline"
                tint={C.LAV_TINT}
                color={C.PLUM}
                title="Need Help"
                sub="Support and guidance."
                onPress={todo("help")}
                divider
              />

              <ListRow
                icon="cog-outline"
                tint={C.IVORY}
                color={C.INK}
                title="Account Settings"
                sub="Manage your account and privacy."
                onPress={() => router.push("/(root)/profile/account-settings")}
                divider
              />

              <ListRow
                icon="logout-variant"
                tint={C.PEACH_TINT}
                color={C.TERRACOTTA}
                title="Logout"
                sub="Sign out from your account."
                onPress={()=>router.replace("/(root)/profile/logout")}
                divider
              />
            </View>
          </View>

          {/* ============ FOOTER ============ */}

          <View style={s.footer}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <Icon
                name="lock-outline"
                size={px(30)}
                color={C.MUTED}
              />

              <Text style={s.footerText}>
                Your data is encrypted and protected with us.
              </Text>
            </View>

            <View style={s.footerLinks}>
              <Text
                style={s.footerLink}
                onPress={() => router.push("/(root)/profile/privacy-policy")}
              >
                Privacy Policy
              </Text>

              <View style={s.footerSep} />

              <Text
                style={s.footerLink}
                onPress={() => router.push("/(root)/profile/terms")}
              >
                Terms of Use
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/* ------------------------------ components ------------------------------ */

function SignTile({
  icon,
  tint,
  color,
  label,
  value,
}: any) {
  return (
    <View style={s.signTile}>
      <View
        style={[
          s.signIcon,
          {
            backgroundColor: tint,
          },
        ]}
      >
        <Icon
          name={icon}
          size={px(38)}
          color={color}
        />
      </View>

      <View
        style={{
          marginLeft: px(14),
          flex: 1,
        }}
      >
        <Text
          style={s.signLabel}
          numberOfLines={1}
        >
          {label}
        </Text>

        <Text
          style={s.signValue}
          numberOfLines={1}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

function QuickTile({
  icon,
  tint,
  color,
  title,
  sub,
  onPress,
}: any) {
  return (
    <Pressable
      onPress={onPress}
      style={s.quickTile}
    >
      <View
        style={[
          s.quickIcon,
          {
            backgroundColor: tint,
          },
        ]}
      >
        <Icon
          name={icon}
          size={px(40)}
          color={color}
        />
      </View>

      <View
        style={{
          flex: 1,
          marginLeft: px(18),
        }}
      >
        <Text
          style={s.quickTitle}
          numberOfLines={1}
        >
          {title}
        </Text>

        <Text
          style={s.quickSub}
          numberOfLines={2}
        >
          {sub}
        </Text>
      </View>

      <Icon
        name="chevron-right"
        size={px(36)}
        color={C.INK}
      />
    </Pressable>
  );
}

function ListRow({
  icon,
  tint,
  color,
  title,
  sub,
  onPress,
  divider,
}: any) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        s.listRow,
        divider && s.listDivider,
      ]}
    >
      <View
        style={[
          s.listIcon,
          {
            backgroundColor: tint,
          },
        ]}
      >
        <Icon
          name={icon}
          size={px(38)}
          color={color}
        />
      </View>

      <View
        style={{
          flex: 1,
          marginLeft: px(20),
        }}
      >
        <Text style={s.listTitle}>
          {title}
        </Text>

        <Text
          style={s.listSub}
          numberOfLines={1}
        >
          {sub}
        </Text>
      </View>

      <Icon
        name="chevron-right"
        size={px(36)}
        color={C.INK}
      />
    </Pressable>
  );
}

/* --------------------------------- styles -------------------------------- */

const s = StyleSheet.create({
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  title: {
    fontSize: fs(48),
    lineHeight: px(56),
    fontWeight: "700",
    color: C.PLUM,
  },

  subtitle: {
    marginTop: px(2),
    fontSize: fs(24),
    color: C.MUTED,
  },

  editBtn: {
    height: px(56),
    paddingHorizontal: px(22),
    flexDirection: "row",
    alignItems: "center",
    gap: px(12),
    borderRadius: px(18),
    backgroundColor: C.PLUM,
    marginTop: px(8),
    marginRight: -px(6),
  },

  editText: {
    fontSize: fs(25),
    fontWeight: "600",
    color: "#fff",
  },

  profileRow: {
    marginTop: px(24),
    flexDirection: "row",
    alignItems: "center",
  },

  avatar: {
    width: px(146),
    height: px(146),
    borderRadius: px(73),
    backgroundColor: "#E9E1F4",
    alignItems: "center",
    justifyContent: "center",
  },

  avatarImage: {
    width: px(146),
    height: px(146),
    borderRadius: px(73),
  },

  avatarOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: px(73),
    backgroundColor: "rgba(43,26,61,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },

  avatarLetter: {
    fontSize: fs(70),
    fontWeight: "600",
    color: C.PLUM,
  },

  camera: {
    position: "absolute",
    right: px(2),
    bottom: px(2),
    width: px(47),
    height: px(47),
    borderRadius: px(24),
    backgroundColor: C.PLUM,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: px(3),
    borderColor: "#fff",
  },

  info: {
    flex: 1,
    marginLeft: px(26),
    minWidth: 0,
  },

  name: {
    fontSize: fs(40),
    fontWeight: "700",
    color: C.PLUM,
  },

  phone: {
    marginTop: px(8),
    fontSize: fs(28),
    color: C.INK,
  },

  placeRow: {
    marginTop: px(10),
    flexDirection: "row",
    alignItems: "center",
    gap: px(8),
  },

  place: {
    flexShrink: 1,
    fontSize: fs(25),
    color: C.MUTED,
  },

  vDivider: {
    width: 1,
    height: px(124),
    marginHorizontal: px(18),
    backgroundColor: C.BORDER,
  },

  birthCol: {
    width: px(215),
  },

  birthCard: {
    height: px(72),
    paddingHorizontal: px(18),
    flexDirection: "row",
    alignItems: "center",
    borderRadius: px(20),
    backgroundColor: "rgba(255,255,255,0.78)",
  },

  birthValue: {
    fontSize: fs(22),
    fontWeight: "600",
    color: C.PLUM,
  },

  birthLabel: {
    marginTop: px(1),
    fontSize: fs(18),
    color: C.MUTED,
  },

  snapshot: {
    marginTop: px(10),
    minHeight: px(244),
    borderRadius: px(26),
    paddingHorizontal: px(24),
    paddingTop: px(30),
    paddingBottom: px(20),
    backgroundColor: "#EDE6F7",
    borderWidth: 1,
    borderColor: "rgba(200,185,225,0.5)",
    overflow: "hidden",
  },

  cardTitle: {
    marginLeft: px(15),
    fontSize: fs(37),
    fontWeight: "700",
    color: C.PLUM,
  },

  cardSub: {
    marginLeft: px(15),
    marginTop: px(4),
    fontSize: fs(24),
    color: C.MUTED,
  },

  signRow: {
    marginTop: px(22),
    flexDirection: "row",
    gap: px(13),
  },

  signTile: {
    flex: 1,
    height: px(103),
    paddingHorizontal: px(15),
    flexDirection: "row",
    alignItems: "center",
    borderRadius: px(22),
    backgroundColor: "rgba(255,255,255,0.9)",
  },

  signIcon: {
    width: px(60),
    height: px(60),
    borderRadius: px(30),
    alignItems: "center",
    justifyContent: "center",
  },

  signLabel: {
    fontSize: fs(21),
    color: C.MUTED,
  },

  signValue: {
    marginTop: px(2),
    fontSize: fs(30),
    fontWeight: "700",
    color: C.PLUM,
  },

  loved: {
    marginTop: px(14),
    minHeight: px(239),
    borderRadius: px(26),
    paddingLeft: px(38),
    paddingRight: px(430),
    paddingTop: px(26),
    paddingBottom: px(20),
    backgroundColor: "#FBE9DE",
    overflow: "hidden",
  },

  lovedTitle: {
    fontSize: fs(38),
    fontWeight: "700",
    color: C.PLUM,
  },

  lovedText: {
    marginTop: px(8),
    fontSize: fs(23),
    lineHeight: px(28),
    color: "#4F4653",
  },

  lovedBtn: {
    alignSelf: "flex-start",
    marginTop: px(20),
    height: px(60),
    paddingHorizontal: px(34),
    flexDirection: "row",
    alignItems: "center",
    borderRadius: px(22),
    backgroundColor: C.TERRACOTTA,
  },

  lovedBtnText: {
    fontSize: fs(25),
    fontWeight: "600",
    color: "#fff",
  },

  panel: {
    marginTop: px(15),
    padding: px(22),
    borderRadius: px(26),
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1,
    borderColor: C.SOFT_LINE,
  },

  panelTitle: {
    marginLeft: px(8),
    fontSize: fs(31),
    fontWeight: "700",
    color: C.PLUM,
  },

  panelSub: {
    marginLeft: px(8),
    marginTop: px(3),
    marginBottom: px(14),
    fontSize: fs(22),
    color: C.MUTED,
  },

  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: px(13),
  },

  quickTile: {
    width: "48.6%",
    height: px(119),
    paddingLeft: px(18),
    paddingRight: px(12),
    flexDirection: "row",
    alignItems: "center",
    borderRadius: px(24),
    backgroundColor: "rgba(255,255,255,0.7)",
    borderWidth: 1,
    borderColor: C.SOFT_LINE,
  },

  quickIcon: {
    width: px(76),
    height: px(76),
    borderRadius: px(38),
    alignItems: "center",
    justifyContent: "center",
  },

  quickTitle: {
    fontSize: fs(23),
    fontWeight: "700",
    color: C.PLUM,
  },

  quickSub: {
    marginTop: px(3),
    fontSize: fs(19),
    lineHeight: px(25),
    color: C.MUTED,
  },

  list: {
    borderRadius: px(24),
    borderWidth: 1,
    borderColor: C.SOFT_LINE,
    backgroundColor: "rgba(255,255,255,0.7)",
    overflow: "hidden",
  },

  listRow: {
    height: px(90),
    paddingHorizontal: px(20),
    flexDirection: "row",
    alignItems: "center",
  },

  listDivider: {
    borderTopWidth: 1,
    borderTopColor: C.SOFT_LINE,
  },

  listIcon: {
    width: px(66),
    height: px(66),
    borderRadius: px(33),
    alignItems: "center",
    justifyContent: "center",
  },

  listTitle: {
    fontSize: fs(23),
    fontWeight: "700",
    color: C.PLUM,
  },

  listSub: {
    marginTop: px(3),
    fontSize: fs(20),
    color: C.MUTED,
  },

  footer: {
    marginTop: px(22),
    alignItems: "center",
  },

  footerText: {
    marginLeft: px(12),
    fontSize: fs(21),
    color: C.MUTED,
  },

  footerLinks: {
    marginTop: px(12),
    flexDirection: "row",
    alignItems: "center",
  },

  footerLink: {
    fontSize: fs(20),
    color: C.INK,
  },

  footerSep: {
    width: 1,
    height: px(22),
    marginHorizontal: px(22),
    backgroundColor: C.BORDER,
  },
});