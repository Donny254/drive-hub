import { describe, expect, it } from "vitest";
import { getCryptoExplorerUrl, formatCryptoNetworkLabel } from "@/lib/crypto";

describe("crypto helpers", () => {
  it("builds explorer links for supported networks", () => {
    expect(getCryptoExplorerUrl("ERC20", "0xabc123")).toBe("https://etherscan.io/tx/0xabc123");
    expect(getCryptoExplorerUrl("TRC20", "T123")).toBe("https://tronscan.org/#/transaction/T123");
  });

  it("formats network labels", () => {
    expect(formatCryptoNetworkLabel("binance-smart-chain")).toBe("binance smart chain");
  });
});
