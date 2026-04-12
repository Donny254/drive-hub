import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { resolveImageUrl } from "@/lib/api";
import { getCryptoExplorerUrl, formatCryptoNetworkLabel } from "@/lib/crypto";
import type { CryptoPaymentStatusResource, CryptoPaymentTransaction } from "@/hooks/useCryptoPaymentStatus";
import { ExternalLink } from "lucide-react";

type CryptoPaymentTimelineProps = {
  title?: string;
  description?: string;
  resource?: CryptoPaymentStatusResource | null;
  transaction?: CryptoPaymentTransaction | null;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => Promise<void> | void;
  refreshing?: boolean;
};

const stepTone = (active: boolean, complete: boolean, failed: boolean) => {
  if (failed) return "destructive";
  if (complete) return "default";
  if (active) return "secondary";
  return "outline";
};

const CryptoPaymentTimeline = ({
  title = "Crypto payment timeline",
  description = "Track your payment proof, review state, and next action.",
  resource,
  transaction,
  loading = false,
  error = null,
  onRefresh,
  refreshing = false,
}: CryptoPaymentTimelineProps) => {
  const status = transaction?.status || resource?.paymentStatus || "pending";
  const explorerUrl = getCryptoExplorerUrl(transaction?.network || null, transaction?.transactionHash || null);
  const hasProof = Boolean(transaction?.proofImageUrl);
  const approved = status === "paid";
  const failed = status === "failed" || status === "cancelled";

  return (
    <Card className="rounded-xl border-border">
      <CardHeader className="border-b border-border pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          {onRefresh ? (
            <Button variant="secondary" size="sm" onClick={() => void onRefresh()} disabled={refreshing}>
              {refreshing ? "Refreshing..." : "Refresh"}
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {loading && <p className="text-sm text-muted-foreground">Loading status...</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="grid gap-3 sm:grid-cols-4">
          {[
            { label: "Submitted", active: true, complete: true, failed: false },
            { label: "Under review", active: status === "pending", complete: approved, failed: false },
            { label: "Approved", active: approved, complete: approved, failed: false },
            { label: "Rejected", active: failed, complete: failed, failed },
          ].map((step) => (
            <div key={step.label} className="rounded-lg border border-border bg-card p-3">
              <Badge variant={stepTone(step.active, step.complete, step.failed)} className="capitalize">
                {step.label}
              </Badge>
              <p className="mt-2 text-xs text-muted-foreground">
                {step.label === "Submitted" && "Transfer proof uploaded and queued."}
                {step.label === "Under review" && "Awaiting admin verification."}
                {step.label === "Approved" && "Payment confirmed and next step unlocked."}
                {step.label === "Rejected" && "Proof was declined or payment failed."}
              </p>
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-secondary/20 p-3 text-sm">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Status</p>
            <p className="mt-1 font-medium capitalize">{status}</p>
          </div>
          <div className="rounded-lg border border-border bg-secondary/20 p-3 text-sm">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Network</p>
            <p className="mt-1 font-medium capitalize">{formatCryptoNetworkLabel(transaction?.network) || "Not specified"}</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-secondary/20 p-3 text-sm">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Transaction Hash</p>
            <p className="mt-1 break-all font-mono text-xs">{transaction?.transactionHash || "Pending"}</p>
          </div>
          <div className="rounded-lg border border-border bg-secondary/20 p-3 text-sm">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Payer Wallet</p>
            <p className="mt-1 break-all font-mono text-xs">{transaction?.payerWallet || "Not provided"}</p>
          </div>
        </div>

        {transaction?.proofImageUrl ? (
          <div className="rounded-lg border border-border bg-secondary/20 p-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Proof Image</p>
            <img
              src={resolveImageUrl(transaction.proofImageUrl)}
              alt="Crypto payment proof"
              className="mt-3 h-40 w-full rounded-md border border-border object-cover"
            />
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-secondary/20 p-3 text-sm text-muted-foreground">
            Payment proof has not been attached yet.
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          {explorerUrl ? (
            <Button asChild variant="secondary" size="sm">
              <a href={explorerUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Open Explorer
              </a>
            </Button>
          ) : null}
          {hasProof ? (
            <Badge variant="secondary">Proof uploaded</Badge>
          ) : (
            <Badge variant="outline">Proof missing</Badge>
          )}
        </div>

        {transaction?.reviewNotes ? (
          <div className="rounded-lg border border-border bg-secondary/20 p-3 text-sm">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Review Notes</p>
            <p className="mt-1 whitespace-pre-wrap">{transaction.reviewNotes}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default CryptoPaymentTimeline;
