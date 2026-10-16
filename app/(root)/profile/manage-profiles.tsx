import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    ImageBackground,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from "react-native";

import { Text } from "../../../components/ui/BrandText";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
    API_URL,
    authHeaders,
} from "../../../lib/auth";

import useProfilesStore from "../../../components/stores/profilesStore";
import { useUserStore } from "../../../components/stores/userStore";

const MANAGE_PROFILE_BG = require(
  "../../../assets/images/profile/manage_profile.png"
);

const MANAGE_PROFILE_BOTTOM = require(
  "../../../assets/images/profile/manage_profile_bottom.png"
);

const C = {
  INK: "#1C1820",
  PLUM: "#2B1A3D",
  TERRACOTTA: "#A94C36",
  GOLD: "#C49A4A",
  LAVENDER: "#F4F0F8",
  CARD: "#FFFDFC",
  MUTED: "#68616A",
  BORDER: "#D9CEC1",
};

export default function ManageProfiles() {
  const insets = useSafeAreaInsets();

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
    price: number;
    credits: number | null;
  }>({
    freeProfiles: 3,
    price: 2,
    credits: null,
  });

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
            Number(data?.free_profiles) || 3,
          price:
            Number(data?.profile_price) || 2,
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
          "Error",
          "Unable to load your profiles."
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

  // Extra profiles allowed for free (besides the user's own), and how many are left.
  const freeExtra = Math.max(0, pricing.freeProfiles - 1);
  const freeLeft = Math.max(0, pricing.freeProfiles - profiles.length);

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
        "Cannot delete",
        "You need to keep at least one profile."
      );

      return;
    }

    if (profileId === activeProfileId) {
      Alert.alert(
        "Active profile",
        "You cannot delete your active profile yet."
      );

      return;
    }

    Alert.alert(
      "Delete Profile",
      `Are you sure you want to delete ${profileName}'s profile?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            deleteProfile(
              profileId,
              profileName
            ),
        },
      ]
    );
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

      Alert.alert(
        "Profile Deleted",
        `${profileName}'s profile has been deleted.`
      );
    } catch (error) {
      console.error(
        "Failed to delete profile:",
        error
      );

      Alert.alert(
        "Error",
        "Unable to delete this profile."
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
    if (!canAddProfile) {
      Alert.alert(
        "Add funds",
        `A new profile costs ₹${pricing.price}. Please add funds to your wallet.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Add Funds",
            onPress: () => router.push("/wallet"),
          },
        ]
      );

      return;
    }

    if (needsPayment) {
      Alert.alert(
        "Add another profile",
        `You've used your ${freeExtra} free profiles. This one costs ₹${pricing.price} from your wallet.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Continue",
            onPress: () =>
              router.push("/profile/add-profile"),
          },
        ]
      );

      return;
    }

    router.push("/profile/add-profile");
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

    const gender =
      profile?.gender
        ?.charAt(0)
        ?.toUpperCase() +
      profile?.gender?.slice(1);

    return [date, gender]
      .filter(Boolean)
      .join(" • ");
  };

  return (
    <ImageBackground
      source={MANAGE_PROFILE_BG}
      resizeMode="cover"
      style={styles.screen}
      imageStyle={styles.backgroundImage}
    >
      <View
        style={[
          styles.container,
          {
            paddingTop: insets.top,
          },
        ]}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={
            styles.content
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>
                Manage Profiles
              </Text>

              <Text style={styles.subtitle}>
                Switch between or edit your profiles.
              </Text>
            </View>

            <Pressable
              onPress={() => handleEdit()}
              style={styles.editButton}
            >
              <Text style={styles.editText}>
                Edit
              </Text>
            </Pressable>
          </View>

          {/* Loading */}
          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator
                size="small"
                color={C.PLUM}
              />

              <Text style={styles.loadingText}>
                Loading profiles...
              </Text>
            </View>
          ) : (
            <>
              {/* Profiles */}
              <View style={styles.profileList}>
                {profiles.map(
                  (profile, index) => {
                    const isActive =
                      profile.profile_id ===
                      activeProfileId;

                    const isDeleting =
                      deletingId ===
                      profile.profile_id;

                    return (
                      <View
                        key={profile.profile_id}
                        style={[
                          styles.profileCard,
                          isActive &&
                            styles.activeProfileCard,
                        ]}
                      >
                        {/* Avatar */}
                        <View
                          style={[
                            styles.profileAvatar,
                            index === 1 &&
                              styles.secondAvatar,
                          ]}
                        >
                          {profile.avatar_url ? (
                            <Image
                              source={{
                                uri: profile.avatar_url,
                              }}
                              style={
                                styles.profileAvatarImage
                              }
                            />
                          ) : (
                            <Text
                              style={
                                styles.profileAvatarText
                              }
                            >
                              {getInitial(
                                profile.name
                              )}
                            </Text>
                          )}
                        </View>

                        {/* Information */}
                        <Pressable
                          style={
                            styles.profileInfo
                          }
                          onPress={() =>
                            handleEdit(
                              profile.profile_id
                            )
                          }
                        >
                          <View
                            style={
                              styles.nameRow
                            }
                          >
                            <Text
                              style={
                                styles.profileName
                              }
                              numberOfLines={1}
                            >
                              {profile.name ||
                                "Unnamed Profile"}
                            </Text>

                            {isActive && (
                              <Text
                                style={
                                  styles.meText
                                }
                              >
                                (Me)
                              </Text>
                            )}
                          </View>

                          <Text
                            style={
                              styles.profileMeta
                            }
                            numberOfLines={1}
                          >
                            {formatProfileInfo(
                              profile
                            )}
                          </Text>
                        </Pressable>

                        {/* Action */}
                        {isDeleting ? (
                          <ActivityIndicator
                            size="small"
                            color={
                              C.TERRACOTTA
                            }
                            style={
                              styles.deleteIcon
                            }
                          />
                        ) : isActive ? (
                          <Pressable
                            onPress={() =>
                              handleEdit(
                                profile.profile_id
                              )
                            }
                            style={
                              styles.arrowButton
                            }
                          >
                            <Icon
                              name="chevron-right"
                              size={27}
                              color={C.INK}
                            />
                          </Pressable>
                        ) : (
                          <Pressable
                            onPress={() =>
                              handleDelete(
                                profile.profile_id,
                                profile.name ||
                                  "this profile"
                              )
                            }
                            style={
                              styles.deleteButton
                            }
                          >
                            <Icon
                              name="trash-can-outline"
                              size={24}
                              color="#FF3B30"
                            />
                          </Pressable>
                        )}
                      </View>
                    );
                  }
                )}
              </View>

              {/* Add another profile */}
              {canAddProfile && (
                <Pressable
                  onPress={
                    handleAddProfile
                  }
                  style={
                    styles.addProfileButton
                  }
                >
                  <View
                    style={
                      styles.addIconCircle
                    }
                  >
                    <Icon
                      name="plus"
                      size={28}
                      color={C.TERRACOTTA}
                    />
                  </View>

                  <View
                    style={
                      styles.addProfileTextContainer
                    }
                  >
                    <Text
                      style={
                        styles.addProfileTitle
                      }
                    >
                      Add Another Profile
                    </Text>

                    <Text
                      style={
                        styles.addProfileSubtitle
                      }
                    >
                      {needsPayment
                        ? `₹${pricing.price} from your wallet · For family and loved ones`
                        : `Free · ${freeLeft} left · For family and loved ones`}
                    </Text>
                  </View>
                </Pressable>
              )}

              {/* Add funds: only when another profile can't be added yet */}
              {!canAddProfile && (
              <View style={styles.infoSection}>

                {/* Illustration container */}
                <View
                  style={
                    styles.illustrationContainer
                  }
                >
                  <ImageBackground
                    source={MANAGE_PROFILE_BOTTOM}
                    resizeMode="cover"
                    style={
                      styles.illustrationImage
                    }
                    imageStyle={
                      styles.illustrationImageStyle
                    }
                  />
                </View>

                {/* Text + button container */}
                <View
                  style={styles.infoContent}
                >
                  <Text
                    style={styles.infoTitle}
                  >
                    {`Add ₹${pricing.price} to create another profile.`}
                  </Text>

                  <Text
                    style={styles.infoText}
                  >
                    {`You can add ${freeExtra} profiles for free; each one after that costs ₹${pricing.price}. Your wallet has ₹${(pricing.credits ?? 0).toFixed(2)}.`}
                  </Text>

                  <Pressable
                    onPress={() =>
                      router.push("/wallet")
                    }
                    style={
                      styles.addFundsButton
                    }
                  >
                    <Text
                      style={
                        styles.addFundsText
                      }
                    >
                      Add Funds
                    </Text>

                    <Icon
                      name="arrow-right"
                      size={22}
                      color="#FFFFFF"
                    />
                  </Pressable>
                </View>
              </View>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  backgroundImage: {
    width: "100%",
    height: "100%",
  },

  container: {
    flex: 1,
    backgroundColor: "transparent",
  },

  content: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },

  /* Header */

  header: {
    minHeight: 92,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  title: {
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "700",
    color: C.INK,
  },

  subtitle: {
    marginTop: 5,
    fontSize: 13,
    color: "#7E7485",
  },

  editButton: {
    paddingTop: 4,
    paddingLeft: 14,
  },

  editText: {
    fontSize: 13,
    fontWeight: "700",
    color: C.PLUM,
  },

  /* Loading */

  loading: {
    minHeight: 280,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: C.MUTED,
  },

  /* Profile list */

  profileList: {
    gap: 10,
  },

  profileCard: {
    minHeight: 72,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#E5DDE6",
    backgroundColor:
      "rgba(255,255,255,0.72)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
  },

  activeProfileCard: {
    borderColor: "#E6A078",
    backgroundColor:
      "rgba(255,255,255,0.82)",
  },

  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FCE3D0",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  profileAvatarImage: {
    width: 48,
    height: 48,
  },

  secondAvatar: {
    backgroundColor: "#FCE8D7",
  },

  profileAvatarText: {
    fontSize: 20,
    fontWeight: "600",
    color: C.TERRACOTTA,
  },

  profileInfo: {
    flex: 1,
    marginLeft: 13,
  },

  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  profileName: {
    maxWidth: "75%",
    fontSize: 15,
    fontWeight: "700",
    color: C.INK,
  },

  meText: {
    marginLeft: 5,
    fontSize: 13,
    fontWeight: "600",
    color: C.INK,
  },

  profileMeta: {
    marginTop: 4,
    fontSize: 12,
    color: "#82798A",
  },

  arrowButton: {
    width: 38,
    height: 46,
    alignItems: "flex-end",
    justifyContent: "center",
  },

  deleteButton: {
    width: 38,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },

  deleteIcon: {
    width: 38,
  },

  /* Add profile */

  addProfileButton: {
    minHeight: 72,
    marginTop: 10,
    borderRadius: 13,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#E5B095",
    backgroundColor:
      "rgba(255,255,255,0.50)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },

  addIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: C.TERRACOTTA,
    alignItems: "center",
    justifyContent: "center",
  },

  addProfileTextContainer: {
    marginLeft: 13,
  },

  addProfileTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: C.TERRACOTTA,
  },

  addProfileSubtitle: {
    marginTop: 3,
    fontSize: 11,
    color: "#8B7D88",
  },

  /* Bottom information section */

  infoSection: {
    marginTop: 16,
    borderRadius: 13,
    overflow: "hidden",
    backgroundColor: "#FFFDFC",
  },

  /* Illustration container */

  illustrationContainer: {
    width: "100%",
    height: 125,
    overflow: "hidden",
    backgroundColor: "#FFFDFC",
  },

  illustrationImage: {
    width: "100%",
    height: "100%",
  },

  illustrationImageStyle: {
    width: "100%",
    height: "100%",
  },

  /* Text + button container */

  infoContent: {
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 7,
    paddingBottom: 12,
    backgroundColor: "#FFFDFC",
  },

  infoTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
    color: C.INK,
    textAlign: "center",
  },

  infoText: {
    marginTop: 4,
    fontSize: 10.5,
    lineHeight: 14,
    color: "#817683",
    textAlign: "center",
    paddingHorizontal: 8,
  },

  addFundsButton: {
    width: "100%",
    height: 42,
    marginTop: 9,
    borderRadius: 11,
    backgroundColor: C.PLUM,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },

  addFundsText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});