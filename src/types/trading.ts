export interface Asset {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  image?: string;
  category: 'crypto' | 'stock' | 'nse' | 'forex';
}

export interface OrderBookEntry {
  price: number;
  amount: number;
  total: number;
}

export interface Trade {
  id: string;
  price: number;
  amount: number;
  side: 'buy' | 'sell';
  timestamp: Date;
}

export interface Portfolio {
  asset: Asset;
  amount: number;
  averagePrice: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
}

export interface StakingPool {
  id: string;
  asset: Asset;
  apy: number;
  totalStaked: number;
  minStake: number;
  lockPeriod: number;
  rewards: number;
}

export interface LiquidityPool {
  id: string;
  token0: Asset;
  token1: Asset;
  tvl: number;
  apr: number;
  volume24h: number;
  fee: number;
}

export interface Loan {
  id: string;
  collateralAsset: Asset;
  borrowAsset: Asset;
  collateralAmount: number;
  borrowAmount: number;
  interestRate: number;
  ltv: number;
  healthFactor: number;
  status: 'active' | 'liquidated' | 'repaid';
}

export interface MarketData {
  crypto: Asset[];
  stocks: Asset[];
  nse: Asset[];
  forex: Asset[];
}

export interface ChartData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
