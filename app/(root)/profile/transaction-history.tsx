import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";
import Reanimated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "../../../components/ui/BrandText";

import {
  refreshWalletCredits,
  useUserStore,
} from "../../../components/stores/userStore";
import { parseServerDate } from "../../../components/utils/serverDate";
import {
  API_URL,
  authHeaders,
} from "../../../lib/auth";
import { translate, useT } from "../../../lib/i18n";

// ============================================================
// TYPES
// ============================================================

type Kind =
  | "chat"
  // Credits spent on creating an extra profile.
  | "profile"
  // A PDF report bought from the wallet.
  | "report"
  | "wallet"
  | "cashback"
  | "failed";

type Tx = {
  id: string;
  kind: Kind;
  // Backend title; when empty, titleKey (+ titleVars) is translated at render.
  title: string;
  titleKey?: string;
  titleVars?: Record<string, string>;
  date: string;
  amount: string;
  // Signed value, for the totals.
  value: number;
  group: "orders" | "recharge";
  photo?: string;
  createdAt?: string;
  // Chats: how long the chat lasted in seconds (shown as "4 min 10 sec").
  durationSeconds?: number;
};

type ApiTransaction = {
  id?: string;
  transaction_id?: string;
  session_id?: string;

  type?: string;
  // e.g. "mantra_daily", "mantra_streak_bonus" for rewards.
  reward_type?: string;
  transaction_type?: string;
  category?: string;
  kind?: string;
  status?: string;

  title?: string;
  description?: string;
  message?: string;

  amount?: number | string;
  credits?: number | string;
  wallet_credits?: number | string;

  astrologer_name?: string;
  astrologer_image?: string;
  astrologer_image_url?: string;

  created_at?: string;
  updated_at?: string;

  [key: string]: unknown;
};

// ============================================================
// CONSTANTS
// ============================================================

const C = {
  INK: "#1C1820",
  PLUM: "#2B1A3D",
  GOLD: "#C49A4A",
  LAVENDER: "#F4F0F8",
  CARD: "#FFFDFC",
  MUTED: "#68616A",
  LINE: "rgba(217,206,193,0.7)",
  SOFT: "#EFE8F7",
  GREEN: "#2E7D4F",
  RED: "#B3392F",
};

// label = translation key.
const FILTERS = [
  { id: "all", label: "transactions.filterAll" },
  { id: "orders", label: "transactions.filterSpent" },
  { id: "recharge", label: "transactions.filterAdded" },
] as const;

// Icon tile per kind of transaction.
const STYLE: Record<Kind, { tint: string; color: string; icon: string; amount: string }> = {
  chat: { tint: C.SOFT, color: C.PLUM, icon: "chat-processing-outline", amount: C.INK },
  report: { tint: "#F6EEDD", color: "#8A6A2C", icon: "file-document-outline", amount: C.INK },
  profile: { tint: C.SOFT, color: C.PLUM, icon: "account-plus-outline", amount: C.INK },
  wallet: { tint: "#E6F2EA", color: C.GREEN, icon: "wallet-plus-outline", amount: C.GREEN },
  cashback: { tint: "#F6EEDD", color: "#8A6A2C", icon: "gift-outline", amount: C.GREEN },
  failed: { tint: "#F8E4E1", color: C.RED, icon: "alert-circle-outline", amount: C.MUTED },
};

// ============================================================
// SCREEN
// ============================================================

export default function TransactionHistory() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const user = useUserStore((state) => state.user);

  // Backend user details uses `credits`.
  // walletBalance is kept as a fallback.
  const balance = user?.credits ?? (user as any)?.walletBalance ?? 0;

  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  // Bumped by "Try again" to load once more.
  const [reloadKey, setReloadKey] = useState(0);

  // ==========================================================
  // FETCH TRANSACTIONS
  // ==========================================================

  useEffect(() => {
    refreshWalletCredits();
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const headers = await authHeaders();
        const response = await fetch(`${API_URL}/api/user/transactions`, { method: "GET", headers });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.detail || translate("transactions.loadFailed"));
        }

        const apiTransactions: ApiTransaction[] = Array.isArray(data?.transactions) ? data.transactions : [];
        const normalized = apiTransactions
          .map(normalizeTransaction)
          .filter((transaction): transaction is Tx => transaction !== null);

        if (cancelled) return;
        setTransactions(normalized);
        setError("");
      } catch (err) {
        console.error("TRANSACTION HISTORY ERROR:", err);
        if (cancelled) return;
        setError(err instanceof Error ? err.message : translate("transactions.loadFailed"));
        setTransactions([]);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const retry = () => {
    setLoaded(false);
    setReloadKey((key) => key + 1);
  };

  // ==========================================================
  // TOTALS + FILTER
  // ==========================================================

  const totals = useMemo(() => {
    let added = 0;
    let spent = 0;
    for (const tx of transactions) {
      if (tx.kind === "failed") continue;
      if (tx.value > 0) added += tx.value;
      else spent += -tx.value;
    }
    return { added, spent };
  }, [transactions]);

  const filteredTransactions = useMemo(
    () => (filter === "all" ? transactions : transactions.filter((tx) => tx.group === filter)),
    [filter, transactions]
  );

  // ==========================================================
  // GROUP BY DATE
  // ==========================================================

  const sections = useMemo(() => {
    const groups = new Map<string, Tx[]>();
    filteredTransactions.forEach((transaction) => {
      const title = getDateGroup(transaction.createdAt);
      const existing = groups.get(title);
      if (existing) existing.push(transaction);
      else groups.set(title, [transaction]);
    });
    return Array.from(groups.entries()).map(([title, items]) => ({ title, items }));
  }, [filteredTransactions]);

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={s.backButton} accessibilityLabel={t("common.back")}>
          <Icon name="chevron-left" size={24} color={C.INK} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{t("transactions.title")}</Text>
          <Text style={s.subtitle}>{t("transactions.subtitle")}</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 32 }]}
      >
        {/* Balance */}
        <Reanimated.View entering={FadeInDown.duration(420)} style={s.balanceCard}>
          <View style={s.balanceRing} />
          <View style={s.balanceRingInner} />

          <View style={s.balanceTop}>
            <View style={{ flex: 1 }}>
              <Text style={s.balanceLabel}>{t("wallet.balanceLabel")}</Text>
              <Text style={s.balanceValue}>₹{Number(balance).toFixed(2)}</Text>
            </View>
            <Pressable onPress={() => router.push("/profile/wallet")} style={s.addButton}>
              <Icon name="plus" size={16} color={C.PLUM} />
              <Text style={s.addButtonText}>{t("wallet.title")}</Text>
            </Pressable>
          </View>

          <View style={s.balanceStats}>
            <View style={s.stat}>
              <Icon name="arrow-bottom-left" size={15} color="#9ED9B4" />
              <View>
                <Text style={s.statLabel}>{t("transactions.added")}</Text>
                <Text style={s.statValue}>₹{totals.added.toFixed(2)}</Text>
              </View>
            </View>
            <View style={s.statDivider} />
            <View style={s.stat}>
              <Icon name="arrow-top-right" size={15} color="#F3DFB4" />
              <View>
                <Text style={s.statLabel}>{t("transactions.spent")}</Text>
                <Text style={s.statValue}>₹{totals.spent.toFixed(2)}</Text>
              </View>
            </View>
          </View>
        </Reanimated.View>

        {/* Filters */}
        <View style={s.segment}>
          {FILTERS.map((item) => {
            const active = item.id === filter;
            return (
              <Pressable
                key={item.id}
                onPress={() => setFilter(item.id)}
                style={[s.segmentItem, active && s.segmentItemActive]}
              >
                <Text style={[s.segmentText, active && s.segmentTextActive]}>{t(item.label)}</Text>
              </Pressable>
            );
          })}
        </View>

        {!loaded ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color={C.PLUM} />
            <Text style={s.centerText}>{t("transactions.loading")}</Text>
          </View>
        ) : error ? (
          <View style={s.center}>
            <View style={s.stateIcon}>
              <Icon name="wifi-off" size={26} color={C.PLUM} />
            </View>
            <Text style={s.stateTitle}>{t("transactions.errorTitle")}</Text>
            <Text style={s.centerText}>{error}</Text>
            <Pressable onPress={retry} style={s.stateButton}>
              <Icon name="refresh" size={17} color={C.CARD} />
              <Text style={s.stateButtonText}>{t("common.retry")}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {sections.map((section, sectionIndex) => (
              <Reanimated.View key={section.title} entering={FadeInDown.delay(60 * sectionIndex).duration(380)}>
                <Text style={s.overline}>{dateGroupLabel(t, section.title).toUpperCase()}</Text>
                <View style={s.groupCard}>
                  {section.items.map((tx, index) => (
                    <TxRow key={tx.id} tx={tx} last={index === section.items.length - 1} />
                  ))}
                </View>
              </Reanimated.View>
            ))}

            {/* Empty */}
            {sections.length === 0 && (
              <View style={s.center}>
                <View style={s.stateIcon}>
                  <Icon name="receipt-text-outline" size={26} color={C.PLUM} />
                </View>
                <Text style={s.stateTitle}>{t("transactions.empty")}</Text>
                <Text style={s.centerText}>
                  {filter === "all"
                    ? t("transactions.emptyAll")
                    : filter === "orders"
                      ? t("transactions.emptySpent")
                      : t("transactions.emptyAdded")}
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// =============================================================
// NORMALIZE API TRANSACTION
// =============================================================

function normalizeTransaction(
  transaction: ApiTransaction
): Tx | null {

  /*
   * Your backend currently creates chat transactions like:
   *
   * {
   *   user_id,
   *   session_id,
   *   type: "chat_billing",
   *   credits: actual_charge,
   *   created_at
   * }
   *
   * There is no `id` or `transaction_id`,
   * so we create a frontend-only ID.
   */

  const id =
    transaction.id ??
    transaction.transaction_id ??
    `${transaction.session_id ?? "transaction"}-${
      transaction.created_at ??
      transaction.updated_at ??
      Date.now()
    }`;

  const rawType =
    String(
      transaction.transaction_type ??
        transaction.type ??
        transaction.kind ??
        transaction.category ??
        ""
    ).toLowerCase();

  const rawStatus =
    String(
      transaction.status ?? ""
    ).toLowerCase();

  // =========================================================
  // KIND
  // =========================================================

  let kind: Kind = "wallet";

  if (
    rawStatus === "failed" ||
    rawStatus === "failure" ||
    rawStatus === "cancelled" ||
    rawStatus === "canceled"
  ) {
    kind = "failed";
  } else if (
    rawType.includes("cashback") ||
    rawType.includes("cash_back") ||
    rawType.includes("reward")
  ) {
    kind = "cashback";
  } else if (
    rawType === "profile_creation"
  ) {
    kind = "profile";
  } else if (
    rawType === "report_purchase"
  ) {
    kind = "report";
  } else if (
    rawType === "chat_billing" ||
    rawType.includes("chat") ||
    rawType.includes("consult") ||
    rawType.includes("astrolog")
  ) {
    kind = "chat";
  } else {
    kind = "wallet";
  }

  // =========================================================
  // GROUP
  // =========================================================

  // Money spent (chats, extra profiles) vs money added.
  const group =
    kind === "chat" || kind === "profile" || kind === "report"
      ? "orders"
      : "recharge";

  // =========================================================
  // TITLE
  // =========================================================

  let title =
    transaction.title ||
    transaction.description ||
    transaction.message ||
    "";

  // No backend title: a translation key, translated when shown.
  let titleKey: string | undefined;
  let titleVars: Record<string, string> | undefined;

  if (!title) {
    if (kind === "profile") {
      titleKey = "transactions.newProfile";
    } else if (kind === "report") {
      titleKey = "transactions.reportPurchase";
    } else if (kind === "chat") {
      if (transaction.astrologer_name) {
        titleKey = "transactions.chatWith";
        titleVars = { name: transaction.astrologer_name };
      } else {
        titleKey = "transactions.chatSession";
      }
    } else if (
      kind === "cashback"
    ) {
      titleKey =
        transaction.reward_type === "mantra_streak_bonus"
          ? "transactions.mantraStreak"
          : transaction.reward_type === "mantra_daily"
            ? "transactions.mantraDaily"
            : "transactions.cashback";
    } else if (
      kind === "failed"
    ) {
      titleKey = "transactions.paymentFailed";
    } else {
      titleKey = "transactions.moneyAdded";
    }
  }

  // =========================================================
  // DATE
  // =========================================================

  const createdAt =
    transaction.created_at ??
    transaction.updated_at ??
    undefined;

  // =========================================================
  // AMOUNT
  // =========================================================

  const rawAmount =
    transaction.amount ??
    transaction.credits ??
    transaction.wallet_credits ??
    0;

  const numericAmount =
    Number(rawAmount) || 0;

  /*
   * Chat billing = money/credits spent.
   * Wallet/cashback = money/credits received.
   */

  let amountPrefix = "";

  if (kind === "chat" || kind === "profile" || kind === "report") {
    amountPrefix = "-";
  } else if (
    numericAmount > 0
  ) {
    amountPrefix = "+";
  }

  const absoluteAmount =
    Math.abs(numericAmount);

  const amount = `${amountPrefix} ₹${absoluteAmount.toFixed(
    2
  )}`;

  const value = amountPrefix === "-" ? -absoluteAmount : amountPrefix === "+" ? absoluteAmount : 0;

  // =========================================================
  // PHOTO
  // =========================================================

  const photo =
    transaction.astrologer_image_url ||
    transaction.astrologer_image ||
    undefined;

  // The backend merges each chat's 30-second charges into one entry.
  const durationSeconds = Number(transaction.duration_seconds);

  const duration =
    kind === "chat" && Number.isFinite(durationSeconds) && durationSeconds > 0
      ? durationSeconds
      : undefined;

  return {
    id: String(id),
    kind,
    title,
    titleKey,
    titleVars,
    date: formatDate(createdAt),
    amount,
    value,
    group,
    photo,
    createdAt,
    durationSeconds: duration,
  };
}

type Translate = (key: string, vars?: Record<string, string | number>) => string;

function formatDuration(t: Translate, totalSeconds: number) {
  const seconds = Math.round(totalSeconds);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;

  if (minutes === 0) return t("transactions.durSec", { sec: rest });
  return rest
    ? t("transactions.durMinSec", { min: minutes, sec: rest })
    : t("transactions.durMin", { min: minutes });
}

// Section heading: "Today" / "Yesterday" / "Older" are translated; dates as they are.
function dateGroupLabel(t: Translate, group: string) {
  if (group === "Today") return t("common.today");
  if (group === "Yesterday") return t("common.yesterday");
  if (group === "Older") return t("transactions.older");
  return group;
}

// =============================================================
// DATE GROUP
// =============================================================

function getDateGroup(
  value?: string
) {
  if (!value) {
    return "Older";
  }

  const date = parseServerDate(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Older";
  }

  const now = new Date();

  // -----------------------------------------------------------
  // TODAY
  // -----------------------------------------------------------

  if (
    date.getFullYear() ===
      now.getFullYear() &&
    date.getMonth() ===
      now.getMonth() &&
    date.getDate() ===
      now.getDate()
  ) {
    return "Today";
  }

  // -----------------------------------------------------------
  // YESTERDAY
  // -----------------------------------------------------------

  const yesterday =
    new Date();

  yesterday.setDate(
    yesterday.getDate() - 1
  );

  if (
    date.getFullYear() ===
      yesterday.getFullYear() &&
    date.getMonth() ===
      yesterday.getMonth() &&
    date.getDate() ===
      yesterday.getDate()
  ) {
    return "Yesterday";
  }

  // -----------------------------------------------------------
  // OLDER
  // -----------------------------------------------------------

  return date.toLocaleDateString(
    [],
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

// =============================================================
// FORMAT DATE
// =============================================================

function formatDate(
  value?: string
) {
  if (!value) {
    return "";
  }

  const date = parseServerDate(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date.toLocaleDateString(
    [],
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

// =============================================================
// FORMAT TIME
// =============================================================

function formatTime(
  value?: string
) {
  if (!value) {
    return "";
  }

  const date = parseServerDate(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date.toLocaleTimeString(
    [],
    {
      hour: "numeric",
      minute: "2-digit",
    }
  );
}

// =============================================================
// TRANSACTION ROW
// =============================================================

function TxRow({ tx, last }: { tx: Tx; last: boolean }) {
  const t = useT();
  const style = STYLE[tx.kind];
  const title = tx.titleKey ? t(tx.titleKey, tx.titleVars) : tx.title;
  const duration = tx.durationSeconds ? formatDuration(t, tx.durationSeconds) : "";
  const time = formatTime(tx.createdAt);

  return (
    <View style={[s.row, !last && s.rowDivider]}>
      {/* Icon, or the astrologer's photo for chats */}
      <View style={[s.tile, { backgroundColor: style.tint }]}>
        <Icon name={style.icon as any} size={21} color={style.color} />
        {!!tx.photo && <Image source={{ uri: tx.photo }} style={StyleSheet.absoluteFill} />}
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={s.rowTitle}>
          {title}
        </Text>
        <Text numberOfLines={1} style={s.rowMeta}>
          {time || tx.date}
          {duration ? ` · ${duration}` : ""}
        </Text>
      </View>

      <View style={{ alignItems: "flex-end" }}>
        <Text style={[s.amount, { color: style.amount }]}>{tx.amount}</Text>
        {tx.kind === "failed" && (
          <View style={s.failedTag}>
            <Text style={s.failedText}>{t("transactions.failed")}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const shadow = {
  shadowColor: "#2B1A3D",
  shadowOpacity: 0.06,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
};

const s = StyleSheet.create({
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

  content: { paddingHorizontal: 16 },

  /* Balance */
  balanceCard: {
    padding: 18,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: C.PLUM,
    ...shadow,
    shadowOpacity: 0.22,
  },
  balanceRing: {
    position: "absolute",
    top: -70,
    right: -50,
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 1,
    borderColor: "rgba(255,253,252,0.12)",
  },
  balanceRingInner: {
    position: "absolute",
    top: -36,
    right: -16,
    width: 122,
    height: 122,
    borderRadius: 61,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(255,253,252,0.16)",
  },
  balanceTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  balanceLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1.4, color: "rgba(255,253,252,0.65)" },
  balanceValue: { marginTop: 4, fontSize: 28, fontWeight: "700", letterSpacing: -0.5, color: C.CARD },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: C.CARD,
  },
  addButtonText: { fontSize: 13, fontWeight: "700", color: C.PLUM },
  balanceStats: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,253,252,0.14)",
  },
  stat: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  statDivider: { width: 1, height: 28, marginHorizontal: 12, backgroundColor: "rgba(255,253,252,0.14)" },
  statLabel: { fontSize: 11, color: "rgba(255,253,252,0.65)" },
  statValue: { marginTop: 1, fontSize: 14, fontWeight: "700", color: C.CARD },

  /* Filters */
  segment: {
    flexDirection: "row",
    marginTop: 16,
    padding: 4,
    gap: 4,
    borderRadius: 999,
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: C.LINE,
  },
  segmentItem: { flex: 1, height: 38, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  segmentItemActive: { backgroundColor: C.PLUM },
  segmentText: { fontSize: 13, fontWeight: "600", color: C.MUTED },
  segmentTextActive: { color: C.CARD },

  /* Groups */
  overline: { marginTop: 20, marginBottom: 8, fontSize: 11, fontWeight: "700", letterSpacing: 1.3, color: C.GOLD },
  groupCard: {
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: C.LINE,
    ...shadow,
  },

  /* Row */
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: "#EFE9F2" },
  tile: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { fontSize: 14, fontWeight: "700", color: C.INK },
  rowMeta: { marginTop: 3, fontSize: 11.5, color: C.MUTED },
  amount: { fontSize: 15, fontWeight: "700" },
  failedTag: { marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: "#F8E4E1" },
  failedText: { fontSize: 10.5, fontWeight: "700", color: C.RED },

  /* States */
  center: { alignItems: "center", justifyContent: "center", paddingHorizontal: 24, paddingTop: 60, gap: 8 },
  centerText: { fontSize: 13, lineHeight: 19, color: C.MUTED, textAlign: "center" },
  stateIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: C.LINE,
    marginBottom: 4,
  },
  stateTitle: { fontSize: 16, fontWeight: "700", color: C.INK, textAlign: "center" },
  stateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 44,
    marginTop: 8,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: C.PLUM,
  },
  stateButtonText: { fontSize: 13.5, fontWeight: "700", color: C.CARD },
});
