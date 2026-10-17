import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from "react-native";

import { Text } from "../../../components/ui/BrandText";
import Reanimated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
    API_URL,
    authHeaders,
} from "../../../lib/auth";

import useProfilesStore from "../../../components/stores/profilesStore";
import BottomSheet from "../../../components/ui/BottomSheet";
import { useUserStore } from "../../../components/stores/userStore";
import { translate, useT } from "../../../lib/i18n";

const C = {
  INK: "#1C1820",
  PLUM: "#2B1A3D",
  TERRACOTTA: "#A94C36",
  GOLD: "#C49A4A",
  LAVENDER: "#F4F0F8",
  CARD: "#FFFDFC",
  MUTED: "#68616A",
  BORDER: "#D9CEC1",
  LINE: "rgba(217,206,193,0.7)",
  SOFT: "#EFE8F7",
  DANGER: "#B3392F",
};

// Shown label for a saved relation value ("Parent" -> "माता-पिता").
const relationLabel = (t: (key: string) => string, value: string) => {
  const key = `profiles.relation.${value}`;
  const label = t(key);
  return label === key ? value : label;
};

// Shown label for a saved gender value ("male" -> "Male").
const genderLabel = (t: (key: string) => string, value?: string) => {
  if (!value) return "";
  const key = `common.${value.toLowerCase()}`;
  const label = t(key);
  return label === key ? value.charAt(0).toUpperCase() + value.slice(1) : label;
};

export default function ManageProfiles() {
  const insets = useSafeAreaInsets();
  const t = useT();

  const user = useUserStore(
    (state) => state.user
  );

  const profiles = useProfilesStore(
    (state) => state.profiles
  );

  const setProfiles = useProfilesStore(
    (state) => state.setProfiles
  );

  const fetchProfiles = useProfilesStore(
    (state) => state.fetchProfiles
  );

  const removeProfile = useProfilesStore(
    (state) => state.removeProfile
  );

  const [loading, setLoading] = useState(true);

  // From GET /profiles: `freeProfiles` counts the user's own profile too
  // (own + 2 more are free), then each new profile costs `price` credits.
  // credits is null when the backend doesn't send it (older backend):
  // then the backend decides when the profile is created.
  const [pricing, setPricing] = useState<{
    freeProfiles: number;
    maxProfiles: number;
    price: number;
    oldPrice: number;
    credits: number | null;
  }>({
    freeProfiles: 2,
    maxProfiles: Infinity,
    price: 29,
    oldPrice: 150,
    credits: null,
  });

  // App-styled sheets instead of system alerts.
  const [paySheet, setPaySheet] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
    avatar?: string | null;
  } | null>(null);

  const [deletingId, setDeletingId] =
    useState<string | null>(null);

  const activeProfileId =
    user?.active_profile_id;

  /**
   * Load profiles (and wallet credits) each time the screen opens,
   * so the balance is current after adding funds or a profile.
   */
  useFocusEffect(
    useCallback(() => {
    const loadProfiles = async () => {
      try {

        const response = await fetch(
          `${API_URL}/api/user/profiles`,
          {
            method: "GET",
            headers: await authHeaders(),
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.detail ||
              "Failed to load profiles"
          );
        }

        setProfiles(
          Array.isArray(data?.profiles)
            ? data.profiles
            : []
        );

        setPricing({
          freeProfiles:
            Number(data?.free_profiles) || 2,
          // Older backend: no limit sent, so don't block here.
          maxProfiles:
            Number(data?.max_profiles) || Infinity,
          price:
            Number(data?.profile_price) || 29,
          oldPrice:
            Number(data?.profile_old_price) || 0,
          credits:
            typeof data?.credits === "number"
              ? data.credits
              : null,
        });
      } catch (error) {
        console.error(
          "Failed to load profiles:",
          error
        );

        Alert.alert(
          translate("profiles.errorTitle"),
          translate("profiles.loadFailed")
        );
      } finally {
        setLoading(false);
      }
    };

    loadProfiles();
    }, [setProfiles])
  );

  const needsPayment =
    profiles.length >= pricing.freeProfiles;

  // How many free profiles are left.
  const freeLeft = Math.max(0, pricing.freeProfiles - profiles.length);

  // One profile besides the user's own.
  const atLimit = profiles.length >= pricing.maxProfiles;

  // "₹29 (₹150 crossed out)" as plain text for alerts.
  // "81% OFF" from the crossed-out price.
  const offPercent =
    pricing.oldPrice > pricing.price
      ? Math.round((1 - pricing.price / pricing.oldPrice) * 100)
      : 0;

  const priceText =
    pricing.oldPrice > pricing.price
      ? t("profiles.priceInstead", { price: pricing.price, oldPrice: pricing.oldPrice, percent: offPercent })
      : `₹${pricing.price}`;

  const canAddProfile =
    !needsPayment ||
    pricing.credits === null ||
    pricing.credits >= pricing.price;

  /**
   * Refresh profiles.
   */
  const refreshProfiles = async () => {
    try {
      await fetchProfiles();
    } catch (error) {
      console.error(
        "Failed to refresh profiles:",
        error
      );
    }
  };

  /**
   * Delete profile.
   */
  const handleDelete = (
    profileId: string,
    profileName: string
  ) => {
    if (profiles.length <= 1) {
      Alert.alert(
        translate("profiles.cannotDelete"),
        translate("profiles.keepOne")
      );

      return;
    }

    if (profileId === activeProfileId) {
      Alert.alert(
        translate("profiles.activeTitle"),
        translate("profiles.activeBody")
      );

      return;
    }

    setDeleteTarget({
      id: profileId,
      name: profileName,
      avatar: profiles.find((p) => p.profile_id === profileId)?.avatar_url,
    });
  };

  const deleteProfile = async (
    profileId: string,
    profileName: string
  ) => {
    try {
      setDeletingId(profileId);

      const response = await fetch(
        `${API_URL}/api/user/profiles/${profileId}`,
        {
          method: "DELETE",
          headers: await authHeaders(),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            "Failed to delete profile"
        );
      }

      removeProfile(profileId);
      setDeleteTarget(null);
    } catch (error) {
      console.error(
        "Failed to delete profile:",
        error
      );

      setDeleteTarget(null);
      Alert.alert(
        translate("profiles.errorTitle"),
        translate("profiles.deleteFailed", { name: profileName })
      );
    } finally {
      setDeletingId(null);
    }
  };

  /**
   * Open edit profile.
   */
  const handleEdit = (
    profileId = activeProfileId
  ) => {
    router.push({
      pathname: "/profile/edit_profile",
      params: profileId ? { profileId } : {},
    });
  };

  /**
   * Add profile.
   */
  const handleAddProfile = () => {
    if (!canAddProfile || needsPayment) {
      setPaySheet(true);
      return;
    }

    router.push("/profile/add-profile");
  };

  // Close the sheet first, then navigate (one modal at a time on iOS).
  const closeThen = (go: () => void) => {
    setPaySheet(false);
    setTimeout(go, 350);
  };

  const getInitial = (
    name?: string
  ) => {
    return (
      name?.trim()?.charAt(0)?.toUpperCase() ||
      "?"
    );
  };

  const formatProfileInfo = (
    profile: any
  ) => {
    const date = profile?.dateOfBirth || "";

    const gender = genderLabel(t, profile?.gender);

    return [date, gender]
      .filter(Boolean)
      .join(" • ");
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backButton} accessibilityLabel={t("common.back")}>
          <Icon name="chevron-left" size={24} color={C.INK} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t("profiles.manageTitle")}</Text>
          <Text style={styles.subtitle}>{t("profiles.manageSubtitle")}</Text>
        </View>
        <Pressable onPress={() => handleEdit()} style={styles.editButton}>
          <Icon name="pencil-outline" size={15} color={C.PLUM} />
          <Text style={styles.editText}>{t("common.edit")}</Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      >
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="small" color={C.PLUM} />
            <Text style={styles.loadingText}>{t("profiles.loading")}</Text>
          </View>
        ) : (
          <>
            <Text style={styles.overline}>
              {profiles.length === 1 ? t("profiles.countOne") : t("profiles.count", { count: profiles.length })}
            </Text>

            {/* Profiles */}
            <View style={styles.profileList}>
              {profiles.map((profile, index) => {
                const isActive = profile.profile_id === activeProfileId;
                const isDeleting = deletingId === profile.profile_id;

                return (
                  <Reanimated.View key={profile.profile_id} entering={FadeInDown.delay(60 * index).duration(400)}>
                    <Pressable
                      onPress={() => handleEdit(profile.profile_id)}
                      style={[styles.profileCard, isActive && styles.activeProfileCard]}
                    >
                      {/* Avatar */}
                      <View style={[styles.avatarRing, isActive && styles.avatarRingActive]}>
                        <View style={styles.profileAvatar}>
                          {profile.avatar_url ? (
                            <Image source={{ uri: profile.avatar_url }} style={styles.profileAvatarImage} />
                          ) : (
                            <Text style={styles.profileAvatarText}>{getInitial(profile.name)}</Text>
                          )}
                        </View>
                      </View>

                      {/* Information */}
                      <View style={styles.profileInfo}>
                        <View style={styles.nameRow}>
                          <Text style={styles.profileName} numberOfLines={1}>
                            {profile.name || t("profiles.unnamed")}
                          </Text>
                          {isActive && (
                            <View style={styles.activePill}>
                              <Text style={styles.activePillText} numberOfLines={1}>{t("profiles.active")}</Text>
                            </View>
                          )}
                        </View>

                        {!!profile.relation && (
                          <Text style={styles.relationText} numberOfLines={1}>
                            {relationLabel(t, profile.relation)}
                          </Text>
                        )}

                        <Text style={styles.profileMeta} numberOfLines={1}>
                          {formatProfileInfo(profile)}
                        </Text>
                      </View>

                      {/* Action */}
                      {isDeleting ? (
                        <ActivityIndicator size="small" color={C.PLUM} style={styles.actionButton} />
                      ) : isActive ? (
                        <View style={styles.actionButton}>
                          <Icon name="chevron-right" size={22} color={C.MUTED} />
                        </View>
                      ) : (
                        <Pressable
                          onPress={() => handleDelete(profile.profile_id, profile.name || t("profiles.thisProfile"))}
                          hitSlop={6}
                          style={[styles.actionButton, styles.deleteButton]}
                          accessibilityLabel={t("profiles.deleteA11y", { name: profile.name || t("profiles.profile") })}
                        >
                          <Icon name="trash-can-outline" size={19} color={C.DANGER} />
                        </Pressable>
                      )}
                    </Pressable>
                  </Reanimated.View>
                );
              })}
            </View>

            {/* Limit reached (only when the backend sets a limit) */}
            {atLimit && (
              <View style={styles.limitNote}>
                <Icon name="information-outline" size={18} color={C.PLUM} />
                <Text style={styles.limitNoteText}>
                  {t("profiles.limitNote")}
                </Text>
              </View>
            )}

            {/* Add another profile */}
            {!atLimit && canAddProfile && (
              <Reanimated.View entering={FadeInDown.delay(60 * profiles.length).duration(400)}>
                <Pressable onPress={handleAddProfile} style={styles.addProfileButton}>
                  <View style={styles.addIconCircle}>
                    <Icon name="plus" size={24} color={C.CARD} />
                  </View>

                  <View style={styles.addProfileTextContainer}>
                    <Text style={styles.addProfileTitle}>{t("profiles.addTitle")}</Text>
                    <Text style={styles.addProfileSubtitle}>{t("profiles.addSub")}</Text>
                  </View>

                  <View style={styles.addPricePill}>
                    {needsPayment ? (
                      <>
                        {pricing.oldPrice > pricing.price && (
                          <Text style={styles.priceOld}>{`₹${pricing.oldPrice}`}</Text>
                        )}
                        <Text style={styles.priceNow}>{`₹${pricing.price}`}</Text>
                        {offPercent > 0 && (
                          <View style={styles.offBadge}>
                            <Text style={styles.offText} numberOfLines={1}>{t("profiles.off", { percent: offPercent })}</Text>
                          </View>
                        )}
                      </>
                    ) : (
                      <Text style={styles.priceNow} numberOfLines={1}>
                        {freeLeft > 1 ? t("profiles.freeLeft", { count: freeLeft }) : t("common.free")}
                      </Text>
                    )}
                  </View>
                </Pressable>
              </Reanimated.View>
            )}

            {/* Add funds: only when another profile can't be added yet */}
            {!atLimit && !canAddProfile && (
              <Reanimated.View entering={FadeInDown.delay(60 * profiles.length).duration(400)} style={styles.fundsCard}>
                <View style={styles.fundsRing} />
                <View style={styles.fundsIcon}>
                  <Icon name="wallet-outline" size={22} color={C.CARD} />
                </View>

                <Text style={styles.fundsTitle}>{t("profiles.fundsTitle", { price: pricing.price })}</Text>
                <Text style={styles.fundsText}>
                  {t("profiles.fundsText", { price: priceText, balance: (pricing.credits ?? 0).toFixed(2) })}
                </Text>

                <Pressable onPress={() => router.push("/wallet")} style={styles.addFundsButton}>
                  <Text style={styles.addFundsText}>{t("wallet.title")}</Text>
                  <Icon name="arrow-right" size={18} color={C.PLUM} />
                </Pressable>
              </Reanimated.View>
            )}

            <View style={styles.footNote}>
              <Icon name="shield-check-outline" size={14} color={C.MUTED} />
              <Text style={styles.footNoteText}>{t("profiles.footNote")}</Text>
            </View>
          </>
        )}
      </ScrollView>

      {/* Paid profile: confirm, or add money first */}
      <BottomSheet visible={paySheet} onClose={() => setPaySheet(false)}>
        <View style={styles.sheetIcon}>
          <Icon name={canAddProfile ? "account-heart-outline" : "wallet-outline"} size={26} color={C.PLUM} />
        </View>
        <Text style={styles.sheetTitle}>{canAddProfile ? t("profiles.addTitle") : t("profiles.addMoneyToContinue")}</Text>
        <Text style={styles.sheetText}>
          {canAddProfile
            ? t("profiles.paySheetText")
            : t("profiles.paySheetNeedMoney", { price: pricing.price })}
        </Text>

        <View style={styles.sheetPriceRow}>
          {pricing.oldPrice > pricing.price && <Text style={styles.sheetPriceOld}>₹{pricing.oldPrice}</Text>}
          <Text style={styles.sheetPrice}>₹{pricing.price}</Text>
          {offPercent > 0 && (
            <View style={styles.offBadge}>
              <Text style={styles.offText}>{t("profiles.off", { percent: offPercent })}</Text>
            </View>
          )}
        </View>

        {pricing.credits !== null && (
          <View style={styles.sheetBalance}>
            <Icon name="wallet-outline" size={16} color={C.MUTED} />
            <Text style={styles.sheetBalanceText}>{t("profiles.walletBalance")}</Text>
            <Text style={[styles.sheetBalanceValue, !canAddProfile && { color: C.DANGER }]}>
              ₹{pricing.credits.toFixed(2)}
            </Text>
          </View>
        )}

        <Pressable
          onPress={() =>
            closeThen(() => router.push(canAddProfile ? "/profile/add-profile" : "/wallet"))
          }
          style={styles.sheetPrimary}
        >
          <Text style={styles.sheetPrimaryText}>
            {canAddProfile ? t("profiles.continuePrice", { price: pricing.price }) : t("wallet.title")}
          </Text>
          <Icon name="arrow-right" size={18} color={C.CARD} />
        </Pressable>
        <Pressable onPress={() => setPaySheet(false)} style={styles.sheetSecondary}>
          <Text style={styles.sheetSecondaryText}>{t("common.notNow")}</Text>
        </Pressable>
      </BottomSheet>

      {/* Delete a profile */}
      <BottomSheet visible={!!deleteTarget} onClose={() => !deletingId && setDeleteTarget(null)}>
        <View style={styles.sheetAvatar}>
          {deleteTarget?.avatar ? (
            <Image source={{ uri: deleteTarget.avatar }} style={styles.profileAvatarImage} />
          ) : (
            <Text style={styles.profileAvatarText}>{getInitial(deleteTarget?.name)}</Text>
          )}
        </View>
        <Text style={styles.sheetTitle}>{t("profiles.deleteTitle", { name: deleteTarget?.name ?? "" })}</Text>
        <Text style={styles.sheetText}>
          {t("profiles.deleteText")}
        </Text>

        <Pressable
          disabled={!!deletingId}
          onPress={() => deleteTarget && deleteProfile(deleteTarget.id, deleteTarget.name)}
          style={[styles.sheetPrimary, styles.sheetDanger]}
        >
          {deletingId ? (
            <ActivityIndicator color={C.CARD} />
          ) : (
            <>
              <Icon name="trash-can-outline" size={18} color={C.CARD} />
              <Text style={styles.sheetPrimaryText}>{t("profiles.deleteButton")}</Text>
            </>
          )}
        </Pressable>
        <Pressable disabled={!!deletingId} onPress={() => setDeleteTarget(null)} style={styles.sheetSecondary}>
          <Text style={styles.sheetSecondaryText}>{t("profiles.keepButton")}</Text>
        </Pressable>
      </BottomSheet>
    </View>
  );
}

const shadow = {
  shadowColor: "#2B1A3D",
  shadowOpacity: 0.07,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 3,
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.LAVENDER },

  /* Header */
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
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: C.LINE,
  },
  editText: { fontSize: 13, fontWeight: "700", color: C.PLUM },

  content: { paddingHorizontal: 16 },

  overline: { marginTop: 6, marginBottom: 10, fontSize: 11, fontWeight: "700", letterSpacing: 1.3, color: C.GOLD },

  /* Loading */
  loading: { minHeight: 280, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 10, fontSize: 13, color: C.MUTED },

  /* Profile list */
  profileList: { gap: 10 },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 20,
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: C.LINE,
    ...shadow,
  },
  activeProfileCard: { borderColor: C.PLUM, borderWidth: 1.5 },

  avatarRing: { width: 56, height: 56, borderRadius: 28, padding: 3, borderWidth: 1.5, borderColor: C.LINE },
  avatarRingActive: { borderColor: "rgba(196,154,74,0.85)" },
  profileAvatar: {
    flex: 1,
    borderRadius: 25,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.SOFT,
  },
  profileAvatarImage: { width: "100%", height: "100%" },
  profileAvatarText: { fontSize: 19, fontWeight: "700", color: C.PLUM },

  profileInfo: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  profileName: { flexShrink: 1, fontSize: 15, fontWeight: "700", color: C.INK },
  activePill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: C.PLUM },
  activePillText: { fontSize: 9.5, fontWeight: "700", letterSpacing: 0.4, color: C.CARD },
  relationText: { marginTop: 2, fontSize: 12, fontWeight: "600", color: "#8A6A2C" },
  profileMeta: { marginTop: 2, fontSize: 12, color: C.MUTED },

  actionButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  deleteButton: { borderRadius: 18, backgroundColor: "#F8E9E7" },

  /* Limit note */
  limitNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: C.SOFT,
  },
  limitNoteText: { flex: 1, fontSize: 12.5, lineHeight: 18, color: C.INK },

  /* Add profile */
  addProfileButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
    padding: 12,
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(43,26,61,0.35)",
    backgroundColor: "rgba(255,253,252,0.6)",
  },
  addIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.PLUM,
  },
  addProfileTextContainer: { flex: 1 },
  addProfileTitle: { fontSize: 15, fontWeight: "700", color: C.INK },
  addProfileSubtitle: { marginTop: 2, fontSize: 12, color: C.MUTED },
  addPricePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#F6EEDD",
    borderWidth: 1,
    borderColor: "rgba(196,154,74,0.45)",
  },
  offBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#E6F2EA",
  },
  offText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.3, color: "#2E7D4F" },
  priceOld: { fontSize: 11, color: C.MUTED, textDecorationLine: "line-through" },
  priceNow: { fontSize: 12, fontWeight: "700", color: "#7A5A1E" },

  /* Add funds */
  fundsCard: {
    marginTop: 12,
    padding: 18,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: C.PLUM,
    ...shadow,
    shadowOpacity: 0.22,
  },
  fundsRing: {
    position: "absolute",
    top: -60,
    right: -40,
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 1,
    borderColor: "rgba(255,253,252,0.12)",
  },
  fundsIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,253,252,0.12)",
    borderWidth: 1,
    borderColor: "rgba(196,154,74,0.5)",
  },
  fundsTitle: { marginTop: 12, fontSize: 16, fontWeight: "700", color: C.CARD },
  fundsText: { marginTop: 4, fontSize: 12.5, lineHeight: 18, color: "rgba(255,253,252,0.75)" },
  addFundsButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: C.CARD,
  },
  addFundsText: { fontSize: 13.5, fontWeight: "700", color: C.PLUM },

  /* Sheets */
  sheetIcon: {
    alignSelf: "center",
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.SOFT,
  },
  sheetAvatar: {
    alignSelf: "center",
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.SOFT,
    borderWidth: 2,
    borderColor: "rgba(196,154,74,0.6)",
  },
  sheetTitle: { marginTop: 14, fontSize: 19, fontWeight: "700", color: C.INK, textAlign: "center" },
  sheetText: { marginTop: 6, fontSize: 13.5, lineHeight: 19, color: C.MUTED, textAlign: "center", paddingHorizontal: 8 },
  sheetPriceRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 16 },
  sheetPriceOld: { fontSize: 15, color: C.MUTED, textDecorationLine: "line-through" },
  sheetPrice: { fontSize: 28, fontWeight: "700", color: C.PLUM },
  sheetBalance: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: C.LAVENDER,
  },
  sheetBalanceText: { flex: 1, fontSize: 13, color: C.MUTED },
  sheetBalanceValue: { fontSize: 14, fontWeight: "700", color: C.INK },
  sheetPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    marginTop: 18,
    borderRadius: 999,
    backgroundColor: C.PLUM,
  },
  sheetDanger: { backgroundColor: C.DANGER },
  sheetPrimaryText: { fontSize: 15, fontWeight: "700", color: C.CARD },
  sheetSecondary: { alignItems: "center", paddingVertical: 14 },
  sheetSecondaryText: { fontSize: 14, fontWeight: "600", color: C.MUTED },

  footNote: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 18 },
  footNoteText: { fontSize: 11.5, color: C.MUTED },
});
