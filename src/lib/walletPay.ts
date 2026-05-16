// USDT contract addresses per network
const USDT_CONTRACTS: Record<string, string> = {
  trc20: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
  tron: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
  erc20: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  ethereum: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  eth: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  bep20: "0x55d398326f99059fF775485246999027B3197955",
  bsc: "0x55d398326f99059fF775485246999027B3197955",
  bnb: "0x55d398326f99059fF775485246999027B3197955",
  polygon: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
  matic: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
  arbitrum: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
  arb: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
  base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  optimism: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
  op: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
};

// BSC USDT uses 18 decimals; all other USDT use 6
const USDT_DECIMALS: Record<string, number> = {
  bep20: 18,
  bsc: 18,
  bnb: 18,
};

export type WalletType = "tron" | "evm" | "unknown";
export type WalletStatus = "checking" | "not_installed" | "locked" | "ready";

export type WalletPayResult = {
  txHash: string;
  payerAddress: string;
  usdtAmount: number;
};

export const getTronStatus = (): WalletStatus => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (!w.tronLink && !w.tronWeb) return "not_installed";
  if (!w.tronWeb?.ready) return "locked";
  return "ready";
};

export const getEvmStatus = (): WalletStatus => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).ethereum ? "ready" : "not_installed";
};

export const connectTronLink = async (): Promise<string> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tronLink = (window as any).tronLink;
  if (!tronLink) throw new Error("TronLink is not installed.");
  // requestAccounts opens TronLink popup — works whether locked or just disconnected
  const result = await tronLink.request({ method: "tron_requestAccounts" });
  if (result.code !== 200) throw new Error("TronLink connection was rejected.");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const address: string = (window as any).tronWeb?.defaultAddress?.base58 ?? "";
  if (!address) throw new Error("No TronLink account found after connecting.");
  return address;
};

export const connectMetaMask = async (): Promise<string> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ethereum = (window as any).ethereum;
  if (!ethereum) throw new Error("MetaMask is not installed.");
  const accounts = (await ethereum.request({ method: "eth_requestAccounts" })) as string[];
  if (!accounts.length) throw new Error("No account found in MetaMask.");
  return accounts[0];
};

export const detectWalletType = (network: string | null): WalletType => {
  if (!network) return "unknown";
  const n = network.trim().toLowerCase();
  if (/^(tron|trc20)$/.test(n)) return "tron";
  if (/^(eth|ethereum|erc20|erc-20|bsc|bnb|bep20|polygon|matic|arb|arbitrum|base|avax|avalanche|optimism|op|celo|fantom|ftm)$/.test(n)) return "evm";
  return "unknown";
};

export const fetchUsdtFromKes = async (kesCents: number): Promise<number> => {
  const kesAmount = kesCents / 100;
  try {
    const resp = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=kes",
      { signal: AbortSignal.timeout(6000) }
    );
    if (resp.ok) {
      const data = (await resp.json()) as { tether?: { kes?: number } };
      const rate = data?.tether?.kes;
      if (rate && rate > 0) {
        return Math.ceil((kesAmount / rate) * 1e6) / 1e6;
      }
    }
  } catch {
    // fall through to fallback
  }
  // Fallback: approximate 1 USDT ≈ 130 KES
  return Math.ceil((kesAmount / 130) * 1e4) / 1e4;
};

export const payWithTronLink = async (
  toAddress: string,
  usdtAmount: number
): Promise<WalletPayResult> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tronWeb = (window as any).tronWeb;
  if (!tronWeb) {
    throw new Error("TronLink is not installed. Install the TronLink extension and refresh.");
  }
  if (!tronWeb.ready) {
    throw new Error("TronLink is locked. Please unlock TronLink and try again.");
  }

  const contractAddress = USDT_CONTRACTS["trc20"];
  const amountSun = Math.round(usdtAmount * 1_000_000);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contract = await (tronWeb.contract() as any).at(contractAddress);
  const txHash = await contract.transfer(toAddress, amountSun).send();

  if (!txHash) throw new Error("Transaction was rejected in TronLink.");

  const payerAddress: string = tronWeb.defaultAddress?.base58 ?? "";
  return { txHash: String(txHash), payerAddress, usdtAmount };
};

export const payWithMetaMask = async (
  toAddress: string,
  usdtAmount: number,
  network: string
): Promise<WalletPayResult> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ethereum = (window as any).ethereum;
  if (!ethereum) {
    throw new Error("MetaMask is not installed. Install MetaMask and refresh.");
  }

  const netKey = network.trim().toLowerCase();
  const contractAddress = USDT_CONTRACTS[netKey];
  if (!contractAddress) {
    throw new Error(`No USDT contract address configured for network: ${network}`);
  }

  const accounts = (await ethereum.request({ method: "eth_requestAccounts" })) as string[];
  if (!accounts.length) throw new Error("No account found in MetaMask.");
  const payerAddress = accounts[0];

  const decimals = USDT_DECIMALS[netKey] ?? 6;
  const amountBn = BigInt(Math.round(usdtAmount * 10 ** decimals));

  // ABI-encode transfer(address,uint256): selector 0xa9059cbb
  const encodedTo = toAddress.replace("0x", "").toLowerCase().padStart(64, "0");
  const encodedAmount = amountBn.toString(16).padStart(64, "0");
  const data = `0xa9059cbb${encodedTo}${encodedAmount}`;

  const txHash = (await ethereum.request({
    method: "eth_sendTransaction",
    params: [{ from: payerAddress, to: contractAddress, data, value: "0x0" }],
  })) as string;

  if (!txHash) throw new Error("Transaction rejected in MetaMask.");
  return { txHash, payerAddress, usdtAmount };
};
