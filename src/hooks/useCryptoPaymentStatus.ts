import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/feedback";

export type CryptoPaymentTransaction = {
  id: string;
  status: "pending" | "paid" | "failed" | "cancelled";
  asset: string;
  network: string | null;
  walletAddress: string | null;
  payerWallet: string | null;
  transactionHash: string;
  proofImageUrl: string | null;
  amountCents: number;
  reviewNotes: string | null;
  createdAt: string;
  updatedAt: string | null;
};

export type CryptoPaymentStatusResource = {
  id: string;
  amountCents: number;
  status: string;
  paymentMethod: string | null;
  paymentStatus: "unpaid" | "pending" | "paid" | "failed";
  paidAt: string | null;
  createdAt: string;
};

type CryptoPaymentStatusResponse = {
  resource: CryptoPaymentStatusResource;
  transaction: CryptoPaymentTransaction | null;
};

const normalizeTransaction = (transaction: Record<string, unknown> | null | undefined) => {
  if (!transaction) return null;
  return {
    id: String(transaction.id || ""),
    status: String(transaction.status || "pending") as CryptoPaymentTransaction["status"],
    asset: String(transaction.asset || "USDT"),
    network: transaction.network ? String(transaction.network) : null,
    walletAddress: transaction.wallet_address ? String(transaction.wallet_address) : null,
    payerWallet: transaction.payer_wallet ? String(transaction.payer_wallet) : null,
    transactionHash: String(transaction.transaction_hash || ""),
    proofImageUrl: transaction.proof_image_url ? String(transaction.proof_image_url) : null,
    amountCents: Number(transaction.amount_cents || 0),
    reviewNotes: transaction.review_notes ? String(transaction.review_notes) : null,
    createdAt: String(transaction.created_at || ""),
    updatedAt: transaction.updated_at ? String(transaction.updated_at) : null,
  };
};

const useCryptoPaymentStatus = (
  path?: string | null,
  enabled = true,
  pollMs = 5000,
  authHeaders: HeadersInit = {}
) => {
  const [data, setData] = useState<CryptoPaymentStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headers = useMemo(() => new Headers(authHeaders), [authHeaders]);

  const refresh = useCallback(async () => {
    if (!path) {
      setData(null);
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const resp = await apiFetch(path, { headers });
      if (!resp.ok) {
        throw new Error(await getApiErrorMessage(resp, "Failed to load payment status"));
      }
      const payload = (await resp.json().catch(() => null)) as Record<string, unknown> | null;
      const normalized = payload
        ? {
            resource: (payload.resource ||
              payload.order ||
              payload.booking ||
              payload.registration ||
              null) as CryptoPaymentStatusResource,
            transaction: normalizeTransaction((payload.transaction as Record<string, unknown> | null) || null),
          }
        : null;
      setData(normalized);
      return normalized;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load payment status";
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [headers, path]);

  useEffect(() => {
    if (!path || !enabled) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    void refresh();
    if (!pollMs) return;
    const interval = window.setInterval(() => {
      void refresh();
    }, pollMs);
    return () => window.clearInterval(interval);
  }, [enabled, path, pollMs, refresh]);

  return { data, loading, error, refresh };
};

export default useCryptoPaymentStatus;
