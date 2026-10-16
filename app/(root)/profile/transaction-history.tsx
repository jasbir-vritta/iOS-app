import {
    MaterialCommunityIcons as Icon,
    Ionicons,
} from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Image,
    ImageBackground,
    Pressable,
    ScrollView,
    StatusBar,
    View,
} from "react-native";

import { Text } from "../../../components/ui/BrandText";
import { SafeAreaView } from "react-native-safe-area-context";

import {
    refreshWalletCredits,
    useUserStore,
} from "../../../components/stores/userStore";
import { parseServerDate } from "../../../components/utils/serverDate";
import {
    API_URL,
    authHeaders,
} from "../../../lib/auth";

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
  title: string;
  date: string;
  amount: string;
  group: "orders" | "recharge";
  photo?: string;
  createdAt?: string;
  // Chats: how long the chat lasted, e.g. "4 min 10 sec".
  duration?: string;
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

const FILTERS = [
  {
    id: "all",
    label: "All",
  },
  {
    id: "orders",
    label: "Orders",
  },
  {
    id: "recharge",
    label: "Recharge",
  },
] as const;

const TERRACOTTA = "#A94C36";
const GREEN = "#2E9E5B";
const RED = "#D92D20";

const STYLE: Record<
  Kind,
  {
    dot?: string;
    line: string;
    tint: string;
    color: string;
    icon: string;
    amount: string;
  }
> = {
  chat: {
    dot: TERRACOTTA,
    line: "#D9A99B",
    tint: "#FBEBE4",
    color: TERRACOTTA,
    icon: "chat-processing-outline",
    amount: RED,
  },

  report: {
    dot: "#2B1A3D",
    line: "#C9BCD6",
    tint: "#EFE7F6",
    color: "#2B1A3D",
    icon: "file-document-outline",
    amount: RED,
  },

  profile: {
    dot: "#2B1A3D",
    line: "#C9BCD6",
    tint: "#EFE7F6",
    color: "#2B1A3D",
    icon: "account-plus-outline",
    amount: RED,
  },

  wallet: {
    dot: GREEN,
    line: "#9ED0AE",
    tint: "#E3F3E8",
    color: GREEN,
    icon: "wallet-outline",
    amount: GREEN,
  },

  cashback: {
    line: "#CFC8D4",
    tint: "#FBEBE4",
    color: TERRACOTTA,
    icon: "gift-outline",
    amount: GREEN,
  },

  failed: {
    line: "#CFC8D4",
    tint: "#FDE7E4",
    color: RED,
    icon: "clock-alert-outline",
    amount: "#1C1820",
  },
};

// ============================================================
// SCREEN
// ============================================================

export default function TransactionHistory() {
  const user = useUserStore(
    (state) => state.user
  );

  // Backend user details uses `credits`.
  // walletBalance is kept as a fallback.
  const balance =
    user?.credits ??
    (user as any)?.walletBalance ??
    0;

  const [filter, setFilter] =
    useState<
      (typeof FILTERS)[number]["id"]
    >("all");

  const [transactions, setTransactions] =
    useState<Tx[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  // ==========================================================
  // FETCH TRANSACTIONS
  // ==========================================================

  useEffect(() => {
    loadTransactions();
    refreshWalletCredits();
  }, []);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      setError("");

      const headers = await authHeaders();

      const response = await fetch(
        `${API_URL}/api/user/transactions`,
        {
          method: "GET",
          headers,
        }
      );

      const data = await response.json();

      console.log(
        "TRANSACTIONS API RESPONSE:",
        data
      );

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            "Failed to load transactions."
        );
      }

      const apiTransactions: ApiTransaction[] =
        Array.isArray(data?.transactions)
          ? data.transactions
          : [];

      const normalized =
        apiTransactions
          .map(normalizeTransaction)
          .filter(
            (
              transaction
            ): transaction is Tx =>
              transaction !== null
          );

      setTransactions(normalized);
    } catch (err) {
      console.error(
        "TRANSACTION HISTORY ERROR:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load transactions."
      );

      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================================
  // FILTER
  // ==========================================================

  const filteredTransactions =
    useMemo(() => {
      if (filter === "all") {
        return transactions;
      }

      return transactions.filter(
        (transaction) =>
          transaction.group === filter
      );
    }, [filter, transactions]);

  // ==========================================================
  // GROUP BY DATE
  // ==========================================================

  const sections = useMemo(() => {
    const groups = new Map<
      string,
      Tx[]
    >();

    filteredTransactions.forEach(
      (transaction) => {
        const title = getDateGroup(
          transaction.createdAt
        );

        const existing =
          groups.get(title);

        if (existing) {
          existing.push(transaction);
        } else {
          groups.set(title, [
            transaction,
          ]);
        }
      }
    );

    return Array.from(
      groups.entries()
    ).map(([title, items]) => ({
      title,
      items,
    }));
  }, [filteredTransactions]);

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <ImageBackground
      source={require(
        "../../../assets/images/profile/language.png"
      )}
      resizeMode="cover"
      style={{
        flex: 1,
        backgroundColor: "#F4F0F8",
      }}
    >
      <StatusBar barStyle="dark-content" />

      <SafeAreaView
        style={{
          flex: 1,
        }}
      >
        <View className="flex-1 px-[20px]">

          {/* =================================================
              HEADER
          ================================================= */}

          <View className="flex-row items-center pt-[6px]">

            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              className="-ml-[8px] h-[44px] w-[44px] items-center justify-center"
            >
              <Ionicons
                name="chevron-back"
                size={26}
                color="#1C1820"
              />
            </Pressable>

            <Text className="flex-1 text-center text-[17px] font-bold text-[#1C1820]">
              Transaction History
            </Text>

            <View className="w-[36px]" />
          </View>

          {/* =================================================
              BALANCE
          ================================================= */}

          <View className="mt-[12px] flex-row items-center rounded-[18px] bg-[#FBEBE1] px-[14px] py-[14px]">

            <View className="h-[44px] w-[44px] items-center justify-center rounded-[13px] bg-[#F5D3C3]">
              <Icon
                name="wallet-outline"
                size={24}
                color={TERRACOTTA}
              />
            </View>

            <View className="ml-[12px] flex-1">

              <Text className="text-[11.5px] text-[#68616A]">
                Available Balance
              </Text>

              <Text className="mt-[1px] text-[26px] font-bold text-[#1C1820]">
                ₹
                {Number(balance).toFixed(
                  2
                )}
              </Text>

            </View>

            <Pressable
              onPress={() =>
                router.push("/profile/wallet")
              }
              className="h-[40px] items-center justify-center rounded-[12px] bg-[#2B1A3D] px-[18px]"
            >
              <Text className="text-[13px] font-semibold text-[#FFFDFC]">
                Add Funds
              </Text>
            </Pressable>

          </View>

          {/* =================================================
              FILTERS
          ================================================= */}

          <View className="mt-[14px] flex-row gap-[10px]">

            {FILTERS.map((item) => {
              const active =
                item.id === filter;

              return (
                <Pressable
                  key={item.id}
                  onPress={() =>
                    setFilter(item.id)
                  }
                  className={`h-[38px] flex-1 items-center justify-center rounded-[12px] border ${
                    active
                      ? "border-[#2B1A3D] bg-[#2B1A3D]"
                      : "border-[#E6DFEA] bg-[#F1EDF3]"
                  }`}
                >
                  <Text
                    className={`text-[13px] font-semibold ${
                      active
                        ? "text-[#FFFDFC]"
                        : "text-[#1C1820]"
                    }`}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}

          </View>

          {/* =================================================
              LOADING
          ================================================= */}

          {loading ? (
            <View className="flex-1 items-center justify-center">

              <ActivityIndicator
                size="large"
                color="#2B1A3D"
              />

              <Text className="mt-[10px] text-[13px] text-[#68616A]">
                Loading transactions...
              </Text>

            </View>
          ) : error ? (

            /* =================================================
               ERROR
            ================================================= */

            <View className="flex-1 items-center justify-center px-[20px]">

              <Ionicons
                name="alert-circle-outline"
                size={42}
                color={RED}
              />

              <Text className="mt-[12px] text-center text-[16px] font-semibold text-[#1C1820]">
                Unable to load transactions
              </Text>

              <Text className="mt-[5px] text-center text-[13px] text-[#68616A]">
                {error}
              </Text>

              <Pressable
                onPress={loadTransactions}
                className="mt-[16px] rounded-[12px] bg-[#2B1A3D] px-[18px] py-[10px]"
              >
                <Text className="text-[13px] font-semibold text-white">
                  Try Again
                </Text>
              </Pressable>

            </View>
          ) : (

            /* =================================================
               TRANSACTIONS
            ================================================= */

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingBottom: 40,
              }}
            >

              {sections.map(
                (section, sectionIndex) => (
                  <View
                    key={section.title}
                  >

                    <Text
                      className={`mb-[2px] text-[18px] font-bold text-[#1C1820] ${
                        sectionIndex === 0
                          ? "mt-[18px]"
                          : "mt-[20px]"
                      }`}
                    >
                      {section.title}
                    </Text>

                    {section.items.map(
                      (tx, index) => (
                        <TxRow
                          key={tx.id}
                          tx={tx}
                          prev={
                            index > 0
                              ? section.items[
                                  index - 1
                                ]
                              : undefined
                          }
                          hasNext={
                            index <
                            section.items
                              .length -
                              1
                          }
                        />
                      )
                    )}

                  </View>
                )
              )}

              {/* =================================================
                  EMPTY
              ================================================= */}

              {sections.length === 0 && (
                <View className="mt-[60px] items-center">

                  <Ionicons
                    name="receipt-outline"
                    size={42}
                    color="#7A727F"
                  />

                  <Text className="mt-[12px] text-[16px] font-semibold text-[#1C1820]">
                    No transactions yet
                  </Text>

                  <Text className="mt-[4px] text-center text-[13px] text-[#68616A]">
                    {filter === "all"
                      ? "Your transactions will appear here."
                      : "No transactions found for this category."}
                  </Text>

                </View>
              )}

            </ScrollView>
          )}

        </View>
      </SafeAreaView>
    </ImageBackground>
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

  if (!title) {
    if (kind === "profile") {
      title = "New profile created";
    } else if (kind === "report") {
      title = "Report purchase";
    } else if (kind === "chat") {
      title =
        transaction.astrologer_name
          ? `Chat with ${transaction.astrologer_name}`
          : "Chat session";
    } else if (
      kind === "cashback"
    ) {
      title =
        transaction.reward_type === "mantra_streak_bonus"
          ? "Mantra streak bonus"
          : transaction.reward_type === "mantra_daily"
            ? "108 chants reward"
            : "Cashback Bonus";
    } else if (
      kind === "failed"
    ) {
      title = "Payment Failed";
    } else {
      title = "Money added to wallet";
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
      ? formatDuration(durationSeconds)
      : undefined;

  return {
    id: String(id),
    kind,
    title,
    date: formatDate(createdAt),
    amount,
    group,
    photo,
    createdAt,
    duration,
  };
}

function formatDuration(totalSeconds: number) {
  const seconds = Math.round(totalSeconds);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;

  if (minutes === 0) return `${rest} sec`;
  return rest ? `${minutes} min ${rest} sec` : `${minutes} min`;
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

function TxRow({
  tx,
  prev,
  hasNext,
}: {
  tx: Tx;
  prev?: Tx;
  hasNext: boolean;
}) {
  const style =
    STYLE[tx.kind];

  const showDot =
    tx.kind !== "failed";

  return (
    <View className="flex-row items-center py-[13px]">

      {/* =====================================================
          TIMELINE RAIL
      ===================================================== */}

      <View
        style={{
          width: 20,
          alignSelf: "stretch",
          alignItems: "center",
        }}
      >

        {!!prev && (
          <View
            style={{
              position: "absolute",
              top: 0,
              height: "50%",
              width: 1.5,
              backgroundColor:
                STYLE[
                  prev.kind
                ].line,
            }}
          />
        )}

        {hasNext && (
          <View
            style={{
              position: "absolute",
              bottom: 0,
              height: "50%",
              width: 1.5,
              backgroundColor:
                style.line,
            }}
          />
        )}

        {showDot && (
          <View
            style={{
              position: "absolute",
              top: "50%",
              marginTop: -5,
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor:
                style.dot ??
                "#FFFDFC",
              borderWidth:
                style.dot ? 0 : 1.5,
              borderColor:
                "#8A8190",
            }}
          />
        )}

      </View>

      {/* =====================================================
          ICON / PHOTO
      ===================================================== */}

      <View
        className="ml-[8px] h-[48px] w-[48px] items-center justify-center overflow-hidden rounded-full"
        style={{
          backgroundColor:
            style.tint,
        }}
      >

        <Icon
          name={
            style.icon as any
          }
          size={23}
          color={
            style.color
          }
        />

        {!!tx.photo && (
          <Image
            source={{
              uri: tx.photo,
            }}
            style={{
              position:
                "absolute",
              width: "100%",
              height: "100%",
            }}
          />
        )}

      </View>

      {/* =====================================================
          TITLE + DATE
      ===================================================== */}

      <View className="ml-[12px] min-w-0 flex-1">

        <Text
          numberOfLines={1}
          className="text-[14px] font-bold text-[#1C1820]"
        >
          {tx.title}
        </Text>

        <Text
          numberOfLines={1}
          className="mt-[3px] text-[11.5px] text-[#817985]"
        >
          {tx.date}

          {tx.createdAt
            ? `, ${formatTime(
                tx.createdAt
              )}`
            : ""}

          {tx.duration ? ` · ${tx.duration}` : ""}
        </Text>

      </View>

      {/* =====================================================
          AMOUNT
      ===================================================== */}

      <View className="ml-[8px] items-end">

        <Text
          className="text-[16px] font-bold"
          style={{
            color:
              style.amount,
          }}
        >
          {tx.amount}
        </Text>

        {tx.kind ===
          "failed" && (
          <View className="mt-[4px] rounded-[8px] bg-[#FDE7E4] px-[10px] py-[2px]">

            <Text
              className="text-[11px] font-semibold"
              style={{
                color: RED,
              }}
            >
              Failed
            </Text>

          </View>
        )}

      </View>

    </View>
  );
}