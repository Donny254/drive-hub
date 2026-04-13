const explorerMap: Array<{ matches: RegExp; baseUrl: string }> = [
  { matches: /^(eth|ethereum|erc20|erc-20)$/i, baseUrl: "https://etherscan.io/tx/" },
  { matches: /^(bsc|bnb|bep20|binance smart chain)$/i, baseUrl: "https://bscscan.com/tx/" },
  { matches: /^(polygon|matic|poly)$/i, baseUrl: "https://polygonscan.com/tx/" },
  { matches: /^(arb|arbitrum)$/i, baseUrl: "https://arbiscan.io/tx/" },
  { matches: /^(base)$/i, baseUrl: "https://basescan.org/tx/" },
  { matches: /^(avax|avalanche)$/i, baseUrl: "https://snowtrace.io/tx/" },
  { matches: /^(optimism|op)$/i, baseUrl: "https://optimistic.etherscan.io/tx/" },
  { matches: /^(tron|trc20)$/i, baseUrl: "https://tronscan.org/#/transaction/" },
  { matches: /^(sol|solana)$/i, baseUrl: "https://solscan.io/tx/" },
  { matches: /^(celo)$/i, baseUrl: "https://celoscan.io/tx/" },
  { matches: /^(fantom|ftm)$/i, baseUrl: "https://ftmscan.com/tx/" },
];

export const normalizeCryptoNetwork = (network?: string | null) =>
  network ? String(network).trim().toLowerCase() : "";

export const getCryptoExplorerUrl = (network?: string | null, transactionHash?: string | null) => {
  const hash = String(transactionHash || "").trim();
  if (!hash) return null;
  const normalizedNetwork = normalizeCryptoNetwork(network);
  const match = explorerMap.find((entry) => entry.matches.test(normalizedNetwork));
  if (!match) return null;
  return `${match.baseUrl}${encodeURIComponent(hash)}`;
};

export const formatCryptoNetworkLabel = (network?: string | null) => {
  if (!network) return null;
  return String(network)
    .trim()
    .replaceAll("_", " ")
    .replaceAll("-", " ");
};
