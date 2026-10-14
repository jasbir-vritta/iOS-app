import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import { useEffect, useState } from "react";
import {
    Image,
    Modal,
    Pressable,
    Text,
    View,
    useWindowDimensions,
} from "react-native";

import useProfilesStore from "../components/stores/profilesStore";
import { useUserStore } from "../components/stores/userStore";

const COLORS = {
  INK: "#1C1820",
  PLUM: "#2B1A3D",
  TERRACOTTA: "#E8742A",
  MUTED: "#7A727F",
  CARD: "rgba(255,255,255,0.88)",
  BORDER: "rgba(150,130,185,0.22)",
};

export default function TopBar() {
  // Chat tab shows History; every other screen shows Rewards.
  const pathname = usePathname();
  // "/chat" (or "/(root)/(tabs)/chat"); not the /chat/vedic etc. screens.
  const onChatTab = pathname.split("/").pop() === "chat";

  const user = useUserStore(
    (state) => state.user
  );

  const updateUser = useUserStore(
    (state) => state.updateUser
  );

  const profiles = useProfilesStore(
    (state) => state.profiles
  );

  const fetchProfiles = useProfilesStore(
    (state) => state.fetchProfiles
  );

  const [
    profileModalVisible,
    setProfileModalVisible,
  ] = useState(false);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const activeProfileId =
    user.active_profile_id;

  const activeProfile = profiles.find(
    (profile) =>
      profile.profile_id ===
      activeProfileId
  );

  const displayName =
    activeProfile?.name?.trim() ||
    user.name?.trim() ||
    "Guest";

  const initial =
    displayName.charAt(0).toUpperCase();

  // The bar is one row: show the first name, and on narrow phones make the
  // History/Rewards button icon-only, so the name isn't cut off.
  const firstName = displayName.split(/\s+/)[0] || displayName;
  const { width: screenWidth } = useWindowDimensions();
  const compact = screenWidth < 380;

  // Profile photo (uploaded from Edit Profile); the initial is the fallback.
  const avatarUrl = activeProfile?.avatar_url;

  const wallet = user.credits ?? 0;

  const handleSelectProfile = (
    profileId: string
  ) => {
    updateUser({
      active_profile_id: profileId,
    });

    setProfileModalVisible(false);
  };

  return (
    <>
      {/* =====================================================
          TOP BAR
      ===================================================== */}

      <View
        style={{
          height: 52,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        {/* ===================================================
            VIEWING AS
        =================================================== */}

        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            minWidth: 0,
          }}
        >
          {/* Avatar */}

          <Pressable
            onPress={() =>
              router.navigate(
                "/(root)/profile"
              )
            }
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                borderWidth: 2,
                borderColor:
                  COLORS.TERRACOTTA,
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                backgroundColor:
                  "rgba(255,255,255,0.5)",
              }}
            >
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={{ width: 40, height: 40, borderRadius: 20 }}
                />
              ) : (
                <Text
                  style={{
                    fontSize: 21,
                    fontWeight: "600",
                    color:
                      COLORS.TERRACOTTA,
                  }}
                >
                  {initial}
                </Text>
              )}
            </View>
          </Pressable>

          {/* Name */}

          <Text
            style={{
              flexShrink: 1,
              marginLeft: 10,
              marginRight: 4,
              fontSize: 16,
              fontWeight: "600",
              color: COLORS.INK,
            }}
            numberOfLines={1}
          >
            {firstName}
          </Text>

          {/* Chevron */}

          <Pressable
            onPress={() =>
              setProfileModalVisible(
                (visible) => !visible
              )
            }
            hitSlop={8}
            style={{
              width: 28,
              height: 28,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon
              name={
                profileModalVisible
                  ? "chevron-up"
                  : "chevron-down"
              }
              size={19}
              color={COLORS.INK}
            />
          </Pressable>
        </View>

        {/* ===================================================
            HISTORY
        =================================================== */}

        {onChatTab && (
        <Pressable
        onPress={() =>
    router.navigate(
      "/(root)/profile/chat-history"
    )
  }
          style={{
            height: 38,
            paddingHorizontal: 10,
            flexDirection: "row",
            alignItems: "center",
            borderRadius: 13,
            backgroundColor: COLORS.CARD,
            borderWidth: 1,
            borderColor: COLORS.BORDER,
          }}
        >
          <Icon
            name="message-text-clock-outline"
            size={16}
            color={COLORS.PLUM}
          />

          {!compact && (
          <Text
            style={{
              marginLeft: 5,
              fontSize: 12,
              fontWeight: "500",
              color: COLORS.INK,
            }}
          >
            History
          </Text>
          )}
        </Pressable>
        )}

        {/* ===================================================
            REWARDS
        =================================================== */}

        {!onChatTab && (
        <Pressable
          onPress={() =>
            router.navigate(
              "/(root)/(tabs)/rewards"
            )
          }
          style={{
            height: 38,
            marginLeft: 8,
            paddingHorizontal: 10,
            flexDirection: "row",
            alignItems: "center",
            borderRadius: 13,
            backgroundColor: COLORS.CARD,
            borderWidth: 1,
            borderColor: COLORS.BORDER,
          }}
        >
          <Icon
            name="gift-outline"
            size={16}
            color={COLORS.PLUM}
          />

          {!compact && (
          <Text
            style={{
              marginLeft: 5,
              fontSize: 12,
              fontWeight: "500",
              color: COLORS.INK,
            }}
          >
            Rewards
          </Text>
          )}
        </Pressable>
        )}

        {/* ===================================================
            WALLET
        =================================================== */}

        <View
          style={{
            height: 48,
            marginLeft: 8,
            paddingLeft: 11,
            paddingRight: 4,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            borderRadius: 16,
            backgroundColor: COLORS.CARD,
            borderWidth: 1,
            borderColor: COLORS.BORDER,
            gap: 8,
          }}
        >
          <View>
            <Text
              style={{
                fontSize: 10,
                color: COLORS.MUTED,
              }}
            >
              Wallet
            </Text>

            <Text
              style={{
                fontSize: 16,
                fontWeight: "700",
                color: COLORS.INK,
                marginTop: -1,
              }}
            >
              ₹{parseInt(wallet)}
            </Text>
          </View>

          {/* Add */}

          <Pressable
       onPress={() =>
                router.push("/profile/wallet")
              }
            style={{
              width: 40,
              height: 40,
              borderRadius: 11,
              backgroundColor: COLORS.PLUM,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon
              name="plus"
              size={20}
              color="#fff"
            />
          </Pressable>
        </View>
      </View>

      {/* =====================================================
          PROFILE SELECTOR MODAL
      ===================================================== */}

      <Modal
        visible={profileModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setProfileModalVisible(false)
        }
      >
        {/* Outside area */}

        <Pressable
          style={{
            flex: 1,
            backgroundColor:
              "rgba(0,0,0,0.15)",
          }}
          onPress={() =>
            setProfileModalVisible(false)
          }
        >
          {/* Profile dropdown */}

          <Pressable
            onPress={(event) =>
              event.stopPropagation()
            }
            style={{
              position: "absolute",
              top: 58,
              left: 16,
              right: 16,
              backgroundColor: "#FFFFFF",
              borderRadius: 16,
              padding: 8,
              borderWidth: 1,
              borderColor:
                COLORS.BORDER,

              shadowColor: "#000",
              shadowOpacity: 0.12,
              shadowRadius: 12,
              shadowOffset: {
                width: 0,
                height: 5,
              },

              elevation: 5,
            }}
          >
            {/* Title */}

            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: COLORS.MUTED,
                paddingHorizontal: 12,
                paddingTop: 6,
                paddingBottom: 8,
              }}
            >
              Select profile
            </Text>

            {/* Profiles */}

            {profiles.map((profile) => {
              const selected =
                profile.profile_id ===
                activeProfileId;

              return (
                <Pressable
                  key={profile.profile_id}
                  onPress={() =>
                    handleSelectProfile(
                      profile.profile_id
                    )
                  }
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 12,
                    borderRadius: 12,
                    backgroundColor:
                      selected
                        ? "rgba(43,26,61,0.07)"
                        : "transparent",
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  {/* Profile avatar */}

                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor:
                        "rgba(232,116,42,0.10)",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                    }}
                  >
                    {profile.avatar_url ? (
                      <Image
                        source={{ uri: profile.avatar_url }}
                        style={{ width: 36, height: 36 }}
                      />
                    ) : (
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "700",
                          color:
                            COLORS.TERRACOTTA,
                        }}
                      >
                        {profile.name
                          ?.charAt(0)
                          .toUpperCase()}
                      </Text>
                    )}
                  </View>

                  {/* Profile name */}

                  <Text
                    style={{
                      flex: 1,
                      marginLeft: 10,
                      fontSize: 15,
                      fontWeight: "600",
                      color: COLORS.INK,
                    }}
                    numberOfLines={1}
                  >
                    {profile.name}
                  </Text>

                  {/* Selected */}

                  {selected && (
                    <Icon
                      name="check"
                      size={20}
                      color={
                        COLORS.PLUM
                      }
                    />
                  )}
                </Pressable>
              );
            })}

            {/* No profiles */}

            {profiles.length === 0 && (
              <Text
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 16,
                  textAlign: "center",
                  color: COLORS.MUTED,
                  fontSize: 13,
                }}
              >
                No profiles found
              </Text>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}