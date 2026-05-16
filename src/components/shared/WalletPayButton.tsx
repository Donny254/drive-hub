import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronDown, ChevronUp, Download, CheckCircle2, Wallet } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import {
  getTronStatus,
  getEvmStatus,
  connectTronLink,
  connectMetaMask,
  fetchUsdtFromKes,
  payWithTronLink,
  payWithMetaMask,
} from "@/lib/walletPay";
import type { WalletStatus } from "@/lib/walletPay";

type WalletConfig = {
  network: string;
  toAddress: string;
};

type WalletPayButtonProps = {
  trc20?: WalletConfig | null;
  evm?: WalletConfig | null;
  asset?: string;
  amountCents: number;
  disabled?: boolean;
  onSuccess: (txHash: string, payerWallet: string) => void;
  showManual?: boolean;
  onToggleManual?: () => void;
};

type WalletSlot = {
  id: "tron" | "evm";
  label: string;
  icon: string;
  installUrl: string;
  config: WalletConfig;
};

type SlotState = {
  status: WalletStatus;
  address: string | null;
  loading: boolean;
};

const INSTALL_LINKS = {
  tron: { label: "Install TronLink", url: "https://www.tronlink.org/" },
  evm: { label: "Install MetaMask", url: "https://metamask.io/download/" },
};

const WalletPayButton = ({
  trc20,
  evm,
  asset = "USDT",
  amountCents,
  disabled = false,
  onSuccess,
  showManual = false,
  onToggleManual,
}: WalletPayButtonProps) => {
  const slots: WalletSlot[] = [
    ...(trc20
      ? [{ id: "tron" as const, label: "TronLink", icon: "🔗", installUrl: INSTALL_LINKS.tron.url, config: trc20 }]
      : []),
    ...(evm
      ? [{ id: "evm" as const, label: "MetaMask", icon: "🦊", installUrl: INSTALL_LINKS.evm.url, config: evm }]
      : []),
  ];

  const [slotStates, setSlotStates] = useState<Record<string, SlotState>>(() =>
    Object.fromEntries(slots.map((s) => [s.id, { status: "checking" as WalletStatus, address: null, loading: false }]))
  );
  const [paying, setPaying] = useState<"tron" | "evm" | null>(null);

  const updateSlot = useCallback((id: string, patch: Partial<SlotState>) => {
    setSlotStates((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }, []);

  const detectAll = useCallback(() => {
    slots.forEach((s) => {
      updateSlot(s.id, { status: "checking" });
      setTimeout(() => {
        const status = s.id === "tron" ? getTronStatus() : getEvmStatus();
        updateSlot(s.id, { status });
      }, 500);
    });
  // slots changes when trc20/evm props change; only re-detect on mount/prop change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trc20, evm, updateSlot]);

  useEffect(() => {
    detectAll();
  }, [detectAll]);

  const handleConnect = async (slot: WalletSlot) => {
    updateSlot(slot.id, { loading: true });
    try {
      const address =
        slot.id === "tron" ? await connectTronLink() : await connectMetaMask();
      updateSlot(slot.id, { address, status: "ready", loading: false });
    } catch (err) {
      updateSlot(slot.id, { loading: false });
      const msg = err instanceof Error ? err.message : "Connection failed.";
      // Re-check in case state changed (e.g. user unlocked)
      const status = slot.id === "tron" ? getTronStatus() : getEvmStatus();
      updateSlot(slot.id, { status });
      toast.error(msg);
    }
  };

  const handlePay = async (slot: WalletSlot) => {
    if (!slot.config.toAddress) {
      toast.error("Wallet address not configured. Contact support.");
      return;
    }
    setPaying(slot.id);
    try {
      toast.loading("Fetching exchange rate…", { id: "wallet-pay" });
      const usdtAmount = await fetchUsdtFromKes(amountCents);

      toast.loading(`Confirm ${usdtAmount.toFixed(4)} ${asset} in ${slot.label}…`, { id: "wallet-pay" });

      let result;
      if (slot.id === "tron") {
        result = await payWithTronLink(slot.config.toAddress, usdtAmount);
      } else {
        result = await payWithMetaMask(slot.config.toAddress, usdtAmount, slot.config.network);
      }

      toast.success("Transaction sent! Submitting payment…", { id: "wallet-pay" });
      onSuccess(result.txHash, result.payerAddress);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Payment failed.";
      toast.error(message, { id: "wallet-pay" });
    } finally {
      setPaying(null);
    }
  };

  if (slots.length === 0) return null;

  const manualToggle = onToggleManual && (
    <button
      type="button"
      className="flex w-full items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      onClick={onToggleManual}
    >
      {showManual ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      {showManual ? "Hide manual entry" : "Or enter transaction hash manually"}
    </button>
  );

  return (
    <div className="space-y-3">
      {slots.map((slot) => {
        const state = slotStates[slot.id] ?? { status: "checking", address: null, loading: false };
        const isPayingThis = paying === slot.id;
        const isPayingOther = paying !== null && paying !== slot.id;

        return (
          <WalletCard
            key={slot.id}
            slot={slot}
            state={state}
            isPaying={isPayingThis}
            isDisabled={disabled || isPayingOther}
            asset={asset}
            onConnect={() => void handleConnect(slot)}
            onPay={() => void handlePay(slot)}
            onRetry={detectAll}
          />
        );
      })}

      {manualToggle}
    </div>
  );
};

type WalletCardProps = {
  slot: WalletSlot;
  state: SlotState;
  isPaying: boolean;
  isDisabled: boolean;
  asset: string;
  onConnect: () => void;
  onPay: () => void;
  onRetry: () => void;
};

const WalletCard = ({ slot, state, isPaying, isDisabled, asset, onConnect, onPay, onRetry }: WalletCardProps) => {
  const networkLabel = slot.config.network.toUpperCase();

  if (state.status === "not_installed") {
    return (
      <div className="rounded-lg border border-border bg-secondary/30 p-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-base">{slot.icon}</span>
          <p className="font-medium">{slot.label} — {networkLabel}</p>
        </div>
        <p className="mt-1 text-muted-foreground">
          {slot.label} is not installed. Install the browser extension to pay directly.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" asChild>
            <a href={slot.installUrl} target="_blank" rel="noreferrer" className="gap-2">
              <Download className="h-4 w-4" />
              Install {slot.label}
            </a>
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onRetry}>
            I just installed it — retry
          </Button>
        </div>
      </div>
    );
  }

  if (state.status === "locked") {
    return (
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-base">{slot.icon}</span>
          <p className="font-medium">{slot.label} is locked — {networkLabel}</p>
        </div>
        <p className="mt-1 text-muted-foreground">
          Open the {slot.label} extension and enter your password, then connect below.
        </p>
        <div className="mt-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onConnect}
            disabled={state.loading}
            className="gap-2"
          >
            {state.loading && <Loader2 className="h-3 w-3 animate-spin" />}
            Unlock & Connect
          </Button>
        </div>
      </div>
    );
  }

  if (state.status === "checking") {
    return (
      <div className="rounded-lg border border-border bg-secondary/20 p-4 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Checking {slot.label}…</span>
        </div>
      </div>
    );
  }

  // ready
  if (!state.address) {
    return (
      <div className="rounded-lg border border-border bg-secondary/20 p-4 text-sm space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-base">{slot.icon}</span>
          <div>
            <p className="font-medium">{slot.label} — {networkLabel}</p>
            <p className="text-xs text-muted-foreground">Not connected</p>
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="w-full gap-2"
          onClick={onConnect}
          disabled={isDisabled || state.loading}
        >
          {state.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
          {state.loading ? "Connecting…" : `Connect ${slot.label}`}
        </Button>
      </div>
    );
  }

  // connected — show pay button
  return (
    <div className="rounded-lg border border-border bg-secondary/20 p-4 text-sm space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-base">{slot.icon}</span>
          <div>
            <p className="font-medium">{slot.label} — {networkLabel}</p>
            <p className="font-mono text-xs text-muted-foreground truncate max-w-[200px]">{state.address}</p>
          </div>
        </div>
        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
      </div>
      <Button
        type="button"
        variant="hero"
        className="w-full gap-2"
        onClick={onPay}
        disabled={isDisabled || isPaying}
      >
        {isPaying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
        {isPaying ? `Sending ${asset}…` : `Pay with ${slot.label}`}
      </Button>
    </div>
  );
};

export default WalletPayButton;
