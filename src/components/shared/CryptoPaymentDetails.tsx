import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Settings2, Copy } from "lucide-react";
import { toast } from "@/components/ui/sonner";

type CryptoPaymentDetailsProps = {
  asset?: string | null;
  network?: string | null;
  walletAddress?: string | null;
  instructions?: string | null;
  adminSettingsPath?: string;
  showAdminShortcut?: boolean;
};

const CryptoPaymentDetails = ({
  asset = "USDT",
  network = null,
  walletAddress = null,
  instructions = null,
  adminSettingsPath = "/admin?tab=settings",
  showAdminShortcut = false,
}: CryptoPaymentDetailsProps) => {
  const copyWalletAddress = async () => {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      toast.success("Wallet address copied.");
    } catch {
      toast.error("Could not copy wallet address.");
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
      <p className="font-medium text-foreground">Crypto Payment</p>
      <p className="mt-2 capitalize">
        {asset}
        {network ? ` on ${network}` : ""}
      </p>
      <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <p className="min-w-0 break-all font-mono text-xs text-primary">
          {walletAddress || "Wallet not configured"}
        </p>
        {walletAddress ? (
          <Button type="button" variant="secondary" size="sm" onClick={() => void copyWalletAddress()}>
            <Copy className="mr-2 h-4 w-4" />
            Copy Wallet
          </Button>
        ) : null}
      </div>
      {!walletAddress && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-border/60 bg-secondary/20 p-3 text-xs text-muted-foreground">
          <Settings2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>
            Crypto wallet details are configured by an admin from <span className="font-medium">Admin Settings</span>.
            Once the wallet is set, it will appear here for payment.
          </p>
        </div>
      )}
      {!walletAddress && showAdminShortcut ? (
        <div className="mt-3">
          <Button asChild variant="secondary" size="sm">
            <Link to={adminSettingsPath}>Open Admin Settings</Link>
          </Button>
        </div>
      ) : null}
      {instructions ? <p className="mt-3 text-xs text-muted-foreground">{instructions}</p> : null}
    </div>
  );
};

export default CryptoPaymentDetails;
