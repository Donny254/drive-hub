import { describe, expect, it } from "vitest";
import { getCryptoExplorerUrl, formatCryptoNetworkLabel, normalizeCryptoNetwork } from "@/lib/crypto";

describe("crypto helpers", () => {
  it("builds explorer links for supported networks", () => {
    expect(getCryptoExplorerUrl("ERC20", "0xabc123")).toBe("https://etherscan.io/tx/0xabc123");
    expect(getCryptoExplorerUrl("TRC20", "T123")).toBe("https://tronscan.org/#/transaction/T123");
  });

  it("formats network labels", () => {
    expect(formatCryptoNetworkLabel("binance-smart-chain")).toBe("binance smart chain");
  });

  it("returns null for unsupported networks", () => {
    expect(getCryptoExplorerUrl("unknown-chain", "0xabc")).toBeNull();
  });

  it("returns null when hash is empty", () => {
    expect(getCryptoExplorerUrl("eth", "")).toBeNull();
    expect(getCryptoExplorerUrl("eth", null)).toBeNull();
  });

  it("returns null when network is missing", () => {
    expect(getCryptoExplorerUrl(null, "0xabc123")).toBeNull();
    expect(getCryptoExplorerUrl(undefined, "0xabc123")).toBeNull();
  });

  it("URL-encodes the transaction hash", () => {
    const hash = "0x" + "a".repeat(64);
    const url = getCryptoExplorerUrl("eth", hash);
    expect(url).toBe(`https://etherscan.io/tx/${hash}`);
  });

  it("handles all EVM network aliases", () => {
    const hash = "0x" + "b".repeat(64);
    expect(getCryptoExplorerUrl("bsc", hash)).toContain("bscscan.com");
    expect(getCryptoExplorerUrl("bnb", hash)).toContain("bscscan.com");
    expect(getCryptoExplorerUrl("polygon", hash)).toContain("polygonscan.com");
    expect(getCryptoExplorerUrl("arb", hash)).toContain("arbiscan.io");
    expect(getCryptoExplorerUrl("base", hash)).toContain("basescan.org");
    expect(getCryptoExplorerUrl("avax", hash)).toContain("snowtrace.io");
    expect(getCryptoExplorerUrl("optimism", hash)).toContain("optimistic.etherscan.io");
    expect(getCryptoExplorerUrl("celo", hash)).toContain("celoscan.io");
    expect(getCryptoExplorerUrl("fantom", hash)).toContain("ftmscan.com");
  });

  it("handles Solana and Tron explorers", () => {
    expect(getCryptoExplorerUrl("sol", "someSolHash")).toContain("solscan.io");
    expect(getCryptoExplorerUrl("solana", "someSolHash")).toContain("solscan.io");
    expect(getCryptoExplorerUrl("tron", "T123")).toContain("tronscan.org");
  });

  it("normalizes network strings to lowercase trimmed", () => {
    expect(normalizeCryptoNetwork("  ETH  ")).toBe("eth");
    expect(normalizeCryptoNetwork(null)).toBe("");
    expect(normalizeCryptoNetwork(undefined)).toBe("");
  });

  it("formatCryptoNetworkLabel returns null for empty input", () => {
    expect(formatCryptoNetworkLabel(null)).toBeNull();
    expect(formatCryptoNetworkLabel(undefined)).toBeNull();
    expect(formatCryptoNetworkLabel("")).toBeNull();
  });

  it("formatCryptoNetworkLabel replaces underscores and dashes with spaces", () => {
    expect(formatCryptoNetworkLabel("binance_smart_chain")).toBe("binance smart chain");
    expect(formatCryptoNetworkLabel("erc-20")).toBe("erc 20");
  });
});
