import { API_URL } from "./auth";
import type { BackendSession } from "./firebaseAuth";

/**
 * Email + password accounts (no Firebase): the backend emails a 6-digit
 * code on sign up and creates the account once it's confirmed.
 *
 *   signup  -> code by email -> verify -> session (new account)
 *   login   -> session
 */

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}/api/auth/email/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("No connection. Check your internet and try again.");
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof data?.detail === "string" ? data.detail : "Something went wrong. Please try again."
    );
  }

  return data as T;
}

type CodeSent = { sent: boolean; expires_in: number; resend_in: number };

/** Starts sign up: checks the email and password and emails a code. */
export const emailSignup = (email: string, password: string, referralCode?: string) =>
  post<CodeSent>("signup", { email, password, referral_code: referralCode || null });

/** A new code for a sign up in progress. */
export const emailResendCode = (email: string) => post<CodeSent>("resend", { email });

/** Confirms the code: creates the account and returns its session. */
export const emailVerifyCode = (email: string, code: string) =>
  post<BackendSession>("verify", { email, code });

/** Logs in an existing email account. */
export const emailLogin = (email: string, password: string) =>
  post<BackendSession>("login", { email, password });

export const isValidEmail = (value: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim());
