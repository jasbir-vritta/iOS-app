import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { useT } from "../../lib/i18n";

// Same card fan, waiting and reveal screens as app/(root)/chat/tarot.tsx,
// used by the live chat with a real tarot astrologer. The card itself is
// drawn by the server when the user taps a face-down card.

const C = {
  plum: "#2B1A3D",
  plumDeep: "#1E1230",
  gold: "#C49A4A",
  card: "#FFFDFC",
  border: "#D9CEC1",
} as const;

const CARD_W = 116;
const CARD_H = 200;
const STEP = 56;
const FAN_COUNT = 15;

export type TarotPickerCard = {
  id?: string;
  name: string;
  image?: string | null;
};

export type TarotPickerPhase = "pick" | "waiting" | "ready";

export function CardBack({ width, height }: { width: number; height: number }) {
  return (
    <View
      style={{
        width,
        height,
        borderRadius: 12,
        backgroundColor: C.plum,
        borderWidth: 1,
        borderColor: "rgba(217,206,193,0.45)",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 6,
      }}
    >
      <View
        style={{
          position: "absolute",
          left: 6,
          right: 6,
          top: 6,
          bottom: 6,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: C.gold,
        }}
      />
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <MaterialCommunityIcons
          name="star-four-points-outline"
          size={Math.round(width * 0.22)}
          color={C.gold}
        />
      </View>
    </View>
  );
}

type Props = {
  phase: TarotPickerPhase;
  astrologerName: string;
  // 1-based card being picked, and how many the astrologer asked for.
  cardNumber: number;
  total: number;
  revealCard: TarotPickerCard | null;
  onPick: () => void;
  onClose: () => void;
  // "Back to chat", or "Pick next card" when more are left.
  onDone: () => void;
};

export function TarotPicker({
  phase,
  astrologerName,
  cardNumber,
  total,
  revealCard,
  onPick,
  onClose,
  onDone,
}: Props) {
  const t = useT();
  const { width } = useWindowDimensions();
  const fanPad = (width - CARD_W) / 2;
  const mid = Math.floor(FAN_COUNT / 2);

  const fanRef = useRef<any>(null);
  const scrollX = useRef(new Animated.Value(mid * STEP)).current;
  const [center, setCenter] = useState(mid);

  const nudgeFan = (dir: 1 | -1) => {
    const next = Math.max(0, Math.min(FAN_COUNT - 1, center + dir));
    fanRef.current?.scrollTo({ x: next * STEP, animated: true });
  };

  const ordinal =
    cardNumber >= 1 && cardNumber <= 3
      ? t(`chat.tarot.ordinal${cardNumber}`)
      : t("chat.tarot.ordinalN", { n: cardNumber });
  const moreLeft = cardNumber < total;
  const left = total - cardNumber;

  const title =
    phase === "pick"
      ? t("chat.tarot.chooseCard", { ordinal })
      : phase === "waiting"
        ? t("chat.tarot.drawing")
        : t("chat.tarot.ready");

  const subtitle =
    phase === "pick"
      ? total > 1
        ? t("chat.tarot.askedFor", { name: astrologerName, total })
        : t("chat.tarot.willReadThis", { name: astrologerName })
      : phase === "waiting"
        ? t("chat.tarot.oneMoment")
        : revealCard?.name ?? "";

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 30,
        backgroundColor: C.plumDeep,
      }}
    >
      <View style={{ paddingHorizontal: 56, paddingTop: 64 }}>
        <Text style={{ textAlign: "center", fontSize: 26, fontWeight: "600", color: C.card }}>
          {title}
        </Text>
        <Text style={{ marginTop: 4, textAlign: "center", fontSize: 15, color: C.border }}>
          {subtitle}
        </Text>
      </View>

      {phase !== "waiting" && (
        <Pressable
          onPress={phase === "ready" ? onDone : onClose}
          hitSlop={12}
          style={{ position: "absolute", right: 20, top: 64, zIndex: 10 }}
          accessibilityLabel={t("common.close")}
        >
          <MaterialCommunityIcons name="close" size={26} color={C.card} />
        </Pressable>
      )}

      {/* PICK */}
      {phase === "pick" && (
        <>
          <View style={{ marginTop: 40, alignItems: "center" }}>
            <View
              style={{
                width: 130,
                height: 220,
                borderRadius: 14,
                borderWidth: 1,
                borderStyle: "dashed",
                borderColor: "rgba(217,206,193,0.5)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 40, color: C.border }}>{cardNumber}</Text>
            </View>
          </View>

          <View style={{ position: "absolute", left: 0, right: 0, bottom: 100, height: CARD_H + 100 }}>
            <Animated.ScrollView
              ref={fanRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={STEP}
              decelerationRate="fast"
              scrollEventThrottle={16}
              onLayout={() => fanRef.current?.scrollTo({ x: mid * STEP, animated: false })}
              onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
                useNativeDriver: true,
                listener: (e: any) => {
                  const i = Math.round(e.nativeEvent.contentOffset.x / STEP);
                  setCenter(Math.max(0, Math.min(i, FAN_COUNT - 1)));
                },
              })}
              contentContainerStyle={{
                paddingLeft: fanPad,
                paddingRight: fanPad + CARD_W - STEP,
                paddingTop: 20,
              }}
            >
              {Array.from({ length: FAN_COUNT }, (_, i) => {
                const at = (k: number) => (i + k) * STEP;

                const rotate = scrollX.interpolate({
                  inputRange: [at(-4), at(0), at(4)],
                  outputRange: ["28deg", "0deg", "-28deg"],
                  extrapolate: "clamp",
                });

                const translateY = scrollX.interpolate({
                  inputRange: [at(-4), at(-2), at(-1), at(0), at(1), at(2), at(4)],
                  outputRange: [64, 16, 4, 0, 4, 16, 64],
                  extrapolate: "clamp",
                });

                return (
                  <Animated.View
                    key={i}
                    style={{
                      width: CARD_W,
                      marginRight: -(CARD_W - STEP),
                      zIndex: 100 - Math.abs(i - center),
                      transform: [{ translateY }, { rotate }],
                    }}
                  >
                    <Pressable onPress={onPick} accessibilityLabel={t("chat.tarot.pickThis")}>
                      <CardBack width={CARD_W} height={CARD_H} />
                    </Pressable>
                  </Animated.View>
                );
              })}
            </Animated.ScrollView>

            {([-1, 1] as const).map((dir) => (
              <Pressable
                key={dir}
                onPress={() => nudgeFan(dir)}
                accessibilityLabel={dir < 0 ? t("chat.tarot.prevCards") : t("chat.tarot.nextCards")}
                style={{
                  position: "absolute",
                  bottom: 10,
                  [dir < 0 ? "left" : "right"]: 16,
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(255,253,252,0.14)",
                }}
              >
                <MaterialCommunityIcons
                  name={dir < 0 ? "chevron-left" : "chevron-right"}
                  size={28}
                  color={C.card}
                />
              </Pressable>
            ))}
          </View>

          <View style={{ position: "absolute", bottom: 40, left: 0, right: 0, alignItems: "center" }}>
            <MaterialCommunityIcons name="gesture-swipe-horizontal" size={26} color={C.border} />
            <Text style={{ marginTop: 8, fontSize: 15, color: C.border }}>{t("chat.tarot.swipeHint")}</Text>
          </View>
        </>
      )}

      {/* WAITING */}
      {phase === "waiting" && (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
          <CardBack width={145} height={250} />
          <ActivityIndicator style={{ marginTop: 32 }} color={C.gold} size="small" />
        </View>
      )}

      {/* READY */}
      {phase === "ready" && revealCard && (
        <>
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            {revealCard.image ? (
              <Image
                source={{ uri: revealCard.image }}
                style={{ width: 190, height: 325, borderRadius: 10 }}
                resizeMode="cover"
              />
            ) : (
              <CardBack width={190} height={325} />
            )}
            <Text style={{ marginTop: 16, fontSize: 20, fontWeight: "600", color: C.card }}>
              {revealCard.name}
            </Text>
          </View>

          <View style={{ alignItems: "center", paddingHorizontal: 20, paddingBottom: 40 }}>
            <View
              style={{
                marginBottom: 20,
                borderRadius: 999,
                paddingHorizontal: 20,
                paddingVertical: 12,
                borderWidth: 1,
                borderColor: "rgba(217,206,193,0.5)",
              }}
            >
              <Text style={{ fontSize: 16, color: C.border }}>
                {moreLeft
                  ? left > 1
                    ? t("chat.tarot.moreLeftMany", { count: left })
                    : t("chat.tarot.moreLeftOne")
                  : total > 1
                    ? t("chat.tarot.willReadMany", { name: astrologerName })
                    : t("chat.tarot.willReadOne", { name: astrologerName })}
              </Text>
            </View>

            <Pressable
              onPress={onDone}
              style={{
                height: 54,
                width: "100%",
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: C.card,
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: "600", color: C.plum }}>
                {moreLeft ? t("chat.tarot.pickNext") : t("chat.backToChat")}
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}
