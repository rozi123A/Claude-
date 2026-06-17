/**
 * FaucetPay Integration — Auto Payout for DigiByte (DGB)
 *
 * HOW TO ACTIVATE:
 *   1. Set FAUCETPAY_API_KEY in environment variables
 *   Done! DGB withdrawals will be sent automatically on approval.
 */

const FAUCETPAY_BASE_URL = "https://faucetpay.io/api/v1";

export interface FostpayPayoutResult {
  success: boolean;
  txHash?: string;
  error?: string;
  fallbackToManual?: boolean;
}

function getFaucetPayConfig() {
  const apiKey = process.env.FAUCETPAY_API_KEY;
  if (!apiKey) return null;
  return { apiKey };
}

export function isFostpayEnabled(): boolean {
  return !!process.env.FAUCETPAY_API_KEY;
}

/**
 * Send DigiByte (DGB) automatically via FaucetPay API
 */
export async function fostpaySendDgb(
  toWallet: string,
  amount: number,
  memo?: string
): Promise<FostpayPayoutResult> {
  const config = getFaucetPayConfig();
  if (!config) {
    return { success: false, fallbackToManual: true, error: "FAUCETPAY_API_KEY not configured" };
  }

  try {
    // FaucetPay expects amount in satoshis (1 DGB = 100,000,000 satoshis)
    const satoshis = Math.round(amount * 1e8);
    const params = new URLSearchParams({
      api_key: config.apiKey,
      to: toWallet,
      amount: String(satoshis),
      currency: "DGB",
    });
    if (memo) params.append("referral", memo.slice(0, 50));

    const res = await fetch(`${FAUCETPAY_BASE_URL}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const data = await res.json() as any;

    if (data.status === 200) {
      return {
        success: true,
        txHash: data.payment_id ? String(data.payment_id) : (data.payout_user_hash || ""),
      };
    }

    return {
      success: false,
      error: data.message || `FaucetPay error: status ${data.status}`,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Network error" };
  }
}

/**
 * Check FaucetPay DGB balance
 */
export async function fostpayGetBalance(): Promise<{ dgb: number } | null> {
  const config = getFaucetPayConfig();
  if (!config) return null;

  try {
    const params = new URLSearchParams({ api_key: config.apiKey, currency: "DGB" });
    const res = await fetch(`${FAUCETPAY_BASE_URL}/balance`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const data = await res.json() as any;
    if (data.status === 200) {
      return { dgb: Number(data.balance || 0) };
    }
    return null;
  } catch {
    return null;
  }
}
