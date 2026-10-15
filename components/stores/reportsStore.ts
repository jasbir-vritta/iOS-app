import * as WebBrowser from "expo-web-browser";
import { create } from "zustand";

import { API_URL, authHeaders } from "../../lib/auth";
import { useUserStore } from "./userStore";

/** One purchase of a report for a profile (from the backend). */
export type ReportOrder = {
  order_id: string;
  report_id: string;
  profile_id: string;
  status: "processing" | "completed" | "failed";
  pdf_url?: string | null;
  // DivineAPI's web version of the report.
  html_url?: string | null;
  price?: number;
  refunded?: boolean;
  report_name?: string;
  lan?: string;
  profile_name?: string;
  language?: string;
  created_at?: string;
};

type ProfileReports = {
  purchases: Record<string, ReportOrder>;
  // report_id -> names of the account's other profiles that bought it.
  boughtForOthers: Record<string, string[]>;
  // report_id -> available (false = coming soon).
  available: Record<string, boolean>;
  // Report languages: code -> label (from the backend).
  languages: Record<string, string>;
  // report_id -> sample report link for Preview (none = no Preview).
  samples: Record<string, string>;
};

type ReportsState = {
  byProfile: Record<string, ProfileReports>;
  loading: Record<string, boolean>;
  setProfileReports: (profileId: string, data: ProfileReports) => void;
  setOrder: (profileId: string, order: ReportOrder) => void;
  setLoading: (profileId: string, value: boolean) => void;
};

export const useReportsStore = create<ReportsState>((set) => ({
  byProfile: {},
  loading: {},
  setProfileReports: (profileId, data) =>
    set((state) => ({ byProfile: { ...state.byProfile, [profileId]: data } })),
  setOrder: (profileId, order) =>
    set((state) => {
      const current = state.byProfile[profileId] || { purchases: {}, boughtForOthers: {}, available: {}, languages: {}, samples: {} };
      return {
        byProfile: {
          ...state.byProfile,
          [profileId]: { ...current, purchases: { ...current.purchases, [order.report_id]: order } },
        },
      };
    }),
  setLoading: (profileId, value) =>
    set((state) => ({ loading: { ...state.loading, [profileId]: value } })),
}));

async function readJson(res: Response) {
  const raw = await res.text();
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** This profile's purchases (and reports bought for other profiles). */
export async function loadProfileReports(profileId: string): Promise<void> {
  if (!profileId) return;

  const store = useReportsStore.getState();
  store.setLoading(profileId, true);

  try {
    const res = await fetch(
      `${API_URL}/reports/mine?profile_id=${encodeURIComponent(profileId)}`,
      { headers: await authHeaders() }
    );
    const json = await readJson(res);
    if (!res.ok || !json) return;

    const available: Record<string, boolean> = {};
    const samples: Record<string, string> = {};
    Object.entries(json.catalogue || {}).forEach(([id, item]: [string, any]) => {
      available[id] = Boolean(item?.available);
      if (item?.sample_url) samples[id] = String(item.sample_url);
    });

    store.setProfileReports(profileId, {
      purchases: json.purchases || {},
      boughtForOthers: json.bought_for_others || {},
      available,
      languages: json.languages || {},
      samples,
    });
  } catch (error) {
    console.warn("Failed to load reports:", error);
  } finally {
    useReportsStore.getState().setLoading(profileId, false);
  }
}

export class ReportPurchaseError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Pay from the wallet and make the PDF. Resolves when it's ready or still being made. */
export async function purchaseReport(
  profileId: string,
  reportId: string,
  lan = "en"
): Promise<ReportOrder> {
  const store = useReportsStore.getState();

  // Show "Preparing" straight away.
  store.setOrder(profileId, {
    order_id: "pending",
    report_id: reportId,
    profile_id: profileId,
    status: "processing",
  });

  try {
    const res = await fetch(`${API_URL}/reports/purchase`, {
      method: "POST",
      headers: { ...(await authHeaders()), "Content-Type": "application/json" },
      body: JSON.stringify({ report_id: reportId, profile_id: profileId, lan }),
    });
    const json = await readJson(res);

    if (!res.ok || !json?.order) {
      throw new ReportPurchaseError(
        json?.detail || "Could not buy this report. Please try again.",
        res.status
      );
    }

    const credits = Number(json.credits);
    if (Number.isFinite(credits)) {
      useUserStore.getState().updateUser({ credits });
    }

    useReportsStore.getState().setOrder(profileId, json.order);
    return json.order;
  } catch (error) {
    // Back to the previous state (nothing was bought).
    await loadProfileReports(profileId);
    throw error;
  }
}

/** Opens a finished report inside the app (web version, or the saved PDF). */
export async function openReport(order?: ReportOrder | null): Promise<void> {
  const url = order?.html_url || order?.pdf_url;
  if (!url) return;

  await WebBrowser.openBrowserAsync(url, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    toolbarColor: "#F6EEE6",
    controlsColor: "#8A3A16",
  });
}

/** Every report bought on this account, newest first (My Reports). */
export async function loadReportHistory(): Promise<ReportOrder[]> {
  try {
    const res = await fetch(`${API_URL}/reports/history`, { headers: await authHeaders() });
    const json = await readJson(res);
    return res.ok && Array.isArray(json?.reports) ? json.reports : [];
  } catch (error) {
    console.warn("Failed to load report history:", error);
    return [];
  }
}
