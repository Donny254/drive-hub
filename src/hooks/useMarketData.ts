import { useState, useEffect, useCallback } from "react";
import { Asset, ChartData } from "@/types/trading";

const COINGECKO_API = "https://api.coingecko.com/api/v3";

type CoinGeckoMarket = {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number | null;
  total_volume: number;
  market_cap: number;
  image?: string;
};

const isCoinGeckoMarket = (value: unknown): value is CoinGeckoMarket => {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.symbol === "string" &&
    typeof item.name === "string" &&
    typeof item.current_price === "number" &&
    typeof item.total_volume === "number" &&
    typeof item.market_cap === "number"
  );
};

const toChartData = (value: unknown): ChartData | null => {
  if (!Array.isArray(value) || value.length < 5) return null;
  const [time, open, high, low, close] = value;
  if (
    typeof time !== "number" ||
    typeof open !== "number" ||
    typeof high !== "number" ||
    typeof low !== "number" ||
    typeof close !== "number"
  ) {
    return null;
  }

  return {
    time,
    open,
    high,
    low,
    close,
    volume: 0,
  };
};

const NSE_STOCKS: Asset[] = [
  { id: "safaricom", symbol: "SCOM", name: "Safaricom PLC", price: 26.5, change24h: 2.5, volume24h: 15000000, marketCap: 1060000000000, category: "nse" },
  { id: "equity", symbol: "EQTY", name: "Equity Group Holdings", price: 42.75, change24h: -1.2, volume24h: 8500000, marketCap: 161000000000, category: "nse" },
  { id: "kcb", symbol: "KCB", name: "KCB Group PLC", price: 28.1, change24h: 0.8, volume24h: 6200000, marketCap: 90000000000, category: "nse" },
  { id: "eabl", symbol: "EABL", name: "East African Breweries", price: 145.0, change24h: -0.5, volume24h: 1200000, marketCap: 115000000000, category: "nse" },
  { id: "cooperative", symbol: "COOP", name: "Co-operative Bank", price: 12.85, change24h: 1.8, volume24h: 4500000, marketCap: 75000000000, category: "nse" },
  { id: "bamburi", symbol: "BAMB", name: "Bamburi Cement", price: 32.0, change24h: -2.1, volume24h: 950000, marketCap: 11600000000, category: "nse" },
  { id: "bat-kenya", symbol: "BAT", name: "BAT Kenya PLC", price: 380.0, change24h: 0.3, volume24h: 420000, marketCap: 38000000000, category: "nse" },
  { id: "absa-kenya", symbol: "ABSA", name: "ABSA Bank Kenya", price: 11.5, change24h: 1.5, volume24h: 3200000, marketCap: 62500000000, category: "nse" },
];

const GLOBAL_STOCKS: Asset[] = [
  { id: "sp500", symbol: "SPY", name: "S&P 500 ETF", price: 515.42, change24h: 0.85, volume24h: 85000000, marketCap: 480000000000, category: "stock" },
  { id: "nasdaq", symbol: "QQQ", name: "Nasdaq 100 ETF", price: 438.2, change24h: 1.2, volume24h: 62000000, marketCap: 210000000000, category: "stock" },
  { id: "apple", symbol: "AAPL", name: "Apple Inc.", price: 189.5, change24h: -0.3, volume24h: 45000000, marketCap: 2900000000000, category: "stock" },
  { id: "tesla", symbol: "TSLA", name: "Tesla Inc.", price: 248.75, change24h: 2.8, volume24h: 78000000, marketCap: 790000000000, category: "stock" },
  { id: "nvidia", symbol: "NVDA", name: "NVIDIA Corp.", price: 875.25, change24h: 3.5, volume24h: 52000000, marketCap: 2160000000000, category: "stock" },
  { id: "microsoft", symbol: "MSFT", name: "Microsoft Corp.", price: 415.8, change24h: 0.6, volume24h: 25000000, marketCap: 3090000000000, category: "stock" },
];

export function useMarketData() {
  const [cryptoAssets, setCryptoAssets] = useState<Asset[]>([]);
  const [nseAssets] = useState<Asset[]>(NSE_STOCKS);
  const [stockAssets] = useState<Asset[]>(GLOBAL_STOCKS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCryptoData = useCallback(async () => {
    try {
      const response = await fetch(
        `${COINGECKO_API}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch crypto data");
      }

      const responseData: unknown = await response.json();
      if (!Array.isArray(responseData)) {
        throw new Error("Unexpected crypto market response format");
      }

      const assets: Asset[] = responseData
        .filter(isCoinGeckoMarket)
        .map((coin) => ({
          id: coin.id,
          symbol: coin.symbol.toUpperCase(),
          name: coin.name,
          price: coin.current_price,
          change24h: coin.price_change_percentage_24h ?? 0,
          volume24h: coin.total_volume,
          marketCap: coin.market_cap,
          image: coin.image,
          category: "crypto" as const,
        }));

      setCryptoAssets(assets);
      setError(null);
    } catch (err) {
      console.error("Error fetching crypto data:", err);
      setError("Failed to fetch market data");
      setCryptoAssets(getFallbackCryptoData());
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchChartData = useCallback(async (coinId: string, days: number = 7): Promise<ChartData[]> => {
    try {
      const response = await fetch(`${COINGECKO_API}/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`);

      if (!response.ok) {
        throw new Error("Failed to fetch chart data");
      }

      const responseData: unknown = await response.json();
      if (!Array.isArray(responseData)) {
        throw new Error("Unexpected chart response format");
      }

      return responseData.map(toChartData).filter((item): item is ChartData => item !== null);
    } catch (err) {
      console.error("Error fetching chart data:", err);
      return generateMockChartData(days);
    }
  }, []);

  useEffect(() => {
    fetchCryptoData();

    const interval = setInterval(fetchCryptoData, 60000);

    return () => clearInterval(interval);
  }, [fetchCryptoData]);

  return {
    cryptoAssets,
    nseAssets,
    stockAssets,
    loading,
    error,
    refetch: fetchCryptoData,
    fetchChartData,
  };
}

function getFallbackCryptoData(): Asset[] {
  return [
    { id: "bitcoin", symbol: "BTC", name: "Bitcoin", price: 67500, change24h: 2.5, volume24h: 28000000000, marketCap: 1320000000000, image: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png", category: "crypto" },
    { id: "ethereum", symbol: "ETH", name: "Ethereum", price: 3450, change24h: 1.8, volume24h: 15000000000, marketCap: 415000000000, image: "https://assets.coingecko.com/coins/images/279/small/ethereum.png", category: "crypto" },
    { id: "solana", symbol: "SOL", name: "Solana", price: 148, change24h: 4.2, volume24h: 3500000000, marketCap: 68000000000, image: "https://assets.coingecko.com/coins/images/4128/small/solana.png", category: "crypto" },
    { id: "binancecoin", symbol: "BNB", name: "BNB", price: 585, change24h: 0.9, volume24h: 1200000000, marketCap: 87000000000, image: "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png", category: "crypto" },
    { id: "ripple", symbol: "XRP", name: "XRP", price: 0.52, change24h: -1.2, volume24h: 1800000000, marketCap: 28500000000, image: "https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png", category: "crypto" },
    { id: "cardano", symbol: "ADA", name: "Cardano", price: 0.45, change24h: 3.1, volume24h: 450000000, marketCap: 16000000000, image: "https://assets.coingecko.com/coins/images/975/small/cardano.png", category: "crypto" },
    { id: "avalanche-2", symbol: "AVAX", name: "Avalanche", price: 35.5, change24h: 2.8, volume24h: 580000000, marketCap: 14000000000, image: "https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png", category: "crypto" },
    { id: "dogecoin", symbol: "DOGE", name: "Dogecoin", price: 0.12, change24h: 5.5, volume24h: 1200000000, marketCap: 17000000000, image: "https://assets.coingecko.com/coins/images/5/small/dogecoin.png", category: "crypto" },
  ];
}

function generateMockChartData(days: number): ChartData[] {
  const data: ChartData[] = [];
  const now = Date.now();
  const interval = (days * 24 * 60 * 60 * 1000) / 100;
  let price = 50000 + Math.random() * 10000;

  for (let i = 100; i >= 0; i -= 1) {
    const volatility = 0.02;
    const change = (Math.random() - 0.5) * 2 * volatility;
    price *= 1 + change;

    const open = price;
    const close = price * (1 + (Math.random() - 0.5) * 0.01);
    const high = Math.max(open, close) * (1 + Math.random() * 0.005);
    const low = Math.min(open, close) * (1 - Math.random() * 0.005);

    data.push({
      time: now - i * interval,
      open,
      high,
      low,
      close,
      volume: Math.random() * 1000000000,
    });
  }

  return data;
}
