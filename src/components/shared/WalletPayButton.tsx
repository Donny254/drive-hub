import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronDown, ChevronUp, Download, CheckCircle2, Wallet, ChevronLeft } from "lucide-react";
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

type WalletId = "tron" | "evm";

type WalletOption = {
  id: WalletId;
  label: string;
  description: string;
  installUrl: string;
  config: WalletConfig;
};

type SlotState = {
  status: WalletStatus;
  address: string | null;
  loading: boolean;
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
  const options: WalletOption[] = [
    ...(trc20
      ? [{ id: "tron" as const, label: "TronLink", description: `USDT · ${trc20.network.toUpperCase()}`, installUrl: "https://www.tronlink.org/", config: trc20 }]
      : []),
    ...(evm
      ? [{ id: "evm" as const, label: "MetaMask", description: `USDT · ${evm.network.toUpperCase()}`, installUrl: "https://metamask.io/download/", config: evm }]
      : []),
  ];

  const [selected, setSelected] = useState<WalletId | null>(null);
  const [slotStates, setSlotStates] = useState<Record<string, SlotState>>(() =>
    Object.fromEntries(options.map((o) => [o.id, { status: "checking" as WalletStatus, address: null, loading: false }]))
  );
  const [paying, setPaying] = useState(false);

  const updateSlot = useCallback((id: string, patch: Partial<SlotState>) => {
    setSlotStates((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }, []);

  const detectAll = useCallback(() => {
    options.forEach((o) => {
      updateSlot(o.id, { status: "checking" });
      setTimeout(() => {
        const status = o.id === "tron" ? getTronStatus() : getEvmStatus();
        updateSlot(o.id, { status });
      }, 500);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trc20, evm, updateSlot]);

  useEffect(() => {
    detectAll();
  }, [detectAll]);

  const handleConnect = async (opt: WalletOption) => {
    updateSlot(opt.id, { loading: true });
    try {
      const address = opt.id === "tron" ? await connectTronLink() : await connectMetaMask();
      updateSlot(opt.id, { address, status: "ready", loading: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Connection failed.";
      const status = opt.id === "tron" ? getTronStatus() : getEvmStatus();
      updateSlot(opt.id, { loading: false, status });
      toast.error(msg);
    }
  };

  const handlePay = async (opt: WalletOption) => {
    if (!opt.config.toAddress) {
      toast.error("Wallet address not configured. Contact support.");
      return;
    }
    setPaying(true);
    try {
      toast.loading("Fetching exchange rate…", { id: "wallet-pay" });
      const usdtAmount = await fetchUsdtFromKes(amountCents);
      toast.loading(`Confirm ${usdtAmount.toFixed(4)} ${asset} in ${opt.label}…`, { id: "wallet-pay" });

      const result =
        opt.id === "tron"
          ? await payWithTronLink(opt.config.toAddress, usdtAmount)
          : await payWithMetaMask(opt.config.toAddress, usdtAmount, opt.config.network);

      toast.success("Transaction sent! Submitting payment…", { id: "wallet-pay" });
      onSuccess(result.txHash, result.payerAddress);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payment failed.", { id: "wallet-pay" });
    } finally {
      setPaying(false);
    }
  };

  if (options.length === 0) return null;

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

  // Step 1: wallet picker
  if (!selected) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">Choose a wallet to pay with</p>
        <div className="grid gap-2">
          {options.map((opt) => {
            const state = slotStates[opt.id] ?? { status: "checking", address: null, loading: false };
            return (
              <button
                key={opt.id}
                type="button"
                disabled={disabled}
                onClick={() => setSelected(opt.id)}
                className="flex items-center justify-between rounded-lg border border-border bg-secondary/20 px-4 py-3 text-left transition-colors hover:bg-secondary/50 disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{opt.id === "tron" ? "🔗" : "🦊"}</span>
                  <div>
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className="text-xs text-muted-foreground">{opt.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {state.status === "checking" && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                  {state.status === "ready" && state.address && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                  {state.status === "not_installed" && <span className="text-xs text-muted-foreground">Not installed</span>}
                  {state.status === "locked" && <span className="text-xs text-amber-500">Locked</span>}
                  <ChevronDown className="h-4 w-4 text-muted-foreground rotate-[-90deg]" />
                </div>
              </button>
            );
          })}
        </div>
        {manualToggle}
      </div>
    );
  }

  // Step 2: selected wallet flow
  const opt = options.find((o) => o.id === selected)!;
  const state = slotStates[opt.id] ?? { status: "checking", address: null, loading: false };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setSelected(null)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-3 w-3" />
        Choose a different wallet
      </button>

      <WalletFlow
        opt={opt}
        state={state}
        paying={paying}
        disabled={disabled}
        asset={asset}
        onConnect={() => void handleConnect(opt)}
        onPay={() => void handlePay(opt)}
        onRetry={detectAll}
      />

      {manualToggle}
    </div>
  );
};

type WalletFlowProps = {
  opt: WalletOption;
  state: SlotState;
  paying: boolean;
  disabled: boolean;
  asset: string;
  onConnect: () => void;
  onPay: () => void;
  onRetry: () => void;
};

const WalletFlow = ({ opt, state, paying, disabled, asset, onConnect, onPay, onRetry }: WalletFlowProps) => {
  if (state.status === "checking") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/20 px-4 py-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking {opt.label}…
      </div>
    );
  }

  if (state.status === "not_installed") {
    return (
      <div className="rounded-lg border border-border bg-secondary/30 p-4 text-sm space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-base">{opt.id === "tron" ? "🔗" : "🦊"}</span>
          <p className="font-medium">{opt.label} is not installed</p>
        </div>
        <p className="text-muted-foreground">Install the browser extension to pay directly.</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" asChild>
            <a href={opt.installUrl} target="_blank" rel="noreferrer" className="gap-2">
              <Download className="h-4 w-4" />
              Install {opt.label}
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
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-base">{opt.id === "tron" ? "🔗" : "🦊"}</span>
          <p className="font-medium">{opt.label} is locked</p>
        </div>
        <p className="text-muted-foreground">
          Open {opt.label}, enter your password to unlock it, then click below.
        </p>
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
    );
  }

  // ready — not yet connected
  if (!state.address) {
    return (
      <div className="rounded-lg border border-border bg-secondary/20 p-4 text-sm space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{opt.id === "tron" ? "🔗" : "🦊"}</span>
          <div>
            <p className="font-medium">{opt.label}</p>
            <p className="text-xs text-muted-foreground">{opt.description} · Not connected</p>
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="w-full gap-2"
          onClick={onConnect}
          disabled={disabled || state.loading}
        >
          {state.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
          {state.loading ? "Connecting…" : `Connect ${opt.label}`}
        </Button>
      </div>
    );
  }

  // connected — show pay button
  return (
    <div className="rounded-lg border border-border bg-secondary/20 p-4 text-sm space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{opt.id === "tron" ? "🔗" : "🦊"}</span>
          <div>
            <p className="font-medium">{opt.label}</p>
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
        disabled={disabled || paying}
      >
        {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
        {paying ? `Sending ${asset}…` : `Pay with ${opt.label}`}
      </Button>
    </div>
  );
};

export default WalletPayButton;
