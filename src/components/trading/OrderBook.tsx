import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface OrderBookEntry {
  price: number;
  amount: number;
  total: number;
}

interface OrderBookProps {
  asks: OrderBookEntry[];
  bids: OrderBookEntry[];
  lastPrice: number;
  priceDecimals?: number;
  amountDecimals?: number;
}

export function OrderBook({ 
  asks, 
  bids, 
  lastPrice,
  priceDecimals = 2,
  amountDecimals = 4 
}: OrderBookProps) {
  const maxTotal = useMemo(() => {
    const maxAsk = asks.length > 0 ? Math.max(...asks.map(a => a.total)) : 0;
    const maxBid = bids.length > 0 ? Math.max(...bids.map(b => b.total)) : 0;
    return Math.max(maxAsk, maxBid);
  }, [asks, bids]);

  const spread = useMemo(() => {
    if (asks.length === 0 || bids.length === 0) return 0;
    return asks[0].price - bids[0].price;
  }, [asks, bids]);

  const spreadPercent = useMemo(() => {
    if (lastPrice === 0) return 0;
    return (spread / lastPrice) * 100;
  }, [spread, lastPrice]);

  return (
    <div className="trading-panel h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-sm text-foreground">Order Book</h3>
        <div className="flex gap-2">
          <button className="text-xs px-2 py-1 rounded bg-secondary text-foreground">0.01</button>
          <button className="text-xs px-2 py-1 rounded bg-secondary/50 text-muted-foreground hover:bg-secondary">0.1</button>
          <button className="text-xs px-2 py-1 rounded bg-secondary/50 text-muted-foreground hover:bg-secondary">1</button>
        </div>
      </div>

      <div className="grid grid-cols-3 text-xs text-muted-foreground mb-2 px-1">
        <span>Price (USD)</span>
        <span className="text-right">Amount</span>
        <span className="text-right">Total</span>
      </div>

      {/* Asks (sell orders) - reversed so lowest ask is at bottom */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto scrollbar-thin flex flex-col-reverse">
          {asks.slice(0, 10).map((ask, i) => (
            <div 
              key={`ask-${i}`}
              className="grid grid-cols-3 text-xs py-0.5 px-1 relative hover:bg-destructive/10 transition-colors"
            >
              <div 
                className="absolute right-0 top-0 bottom-0 bg-destructive/10"
                style={{ width: `${(ask.total / maxTotal) * 100}%` }}
              />
              <span className="text-destructive relative z-10">{ask.price.toFixed(priceDecimals)}</span>
              <span className="text-right text-foreground relative z-10">{ask.amount.toFixed(amountDecimals)}</span>
              <span className="text-right text-muted-foreground relative z-10">{ask.total.toFixed(amountDecimals)}</span>
            </div>
          ))}
        </div>

        {/* Spread */}
        <div className="py-2 px-1 border-y border-border/50 bg-secondary/20">
          <div className="flex items-center justify-between">
            <span className={cn(
              "text-lg font-mono font-bold",
              lastPrice > 0 ? "text-success" : "text-foreground"
            )}>
              ${lastPrice.toLocaleString(undefined, { minimumFractionDigits: priceDecimals })}
            </span>
            <span className="text-xs text-muted-foreground">
              Spread: {spread.toFixed(priceDecimals)} ({spreadPercent.toFixed(2)}%)
            </span>
          </div>
        </div>

        {/* Bids (buy orders) */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {bids.slice(0, 10).map((bid, i) => (
            <div 
              key={`bid-${i}`}
              className="grid grid-cols-3 text-xs py-0.5 px-1 relative hover:bg-success/10 transition-colors"
            >
              <div 
                className="absolute right-0 top-0 bottom-0 bg-success/10"
                style={{ width: `${(bid.total / maxTotal) * 100}%` }}
              />
              <span className="text-success relative z-10">{bid.price.toFixed(priceDecimals)}</span>
              <span className="text-right text-foreground relative z-10">{bid.amount.toFixed(amountDecimals)}</span>
              <span className="text-right text-muted-foreground relative z-10">{bid.total.toFixed(amountDecimals)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Generate mock order book data
export function generateOrderBook(midPrice: number, levels: number = 15) {
  const asks: OrderBookEntry[] = [];
  const bids: OrderBookEntry[] = [];

  let askTotal = 0;
  let bidTotal = 0;

  for (let i = 0; i < levels; i++) {
    const askPrice = midPrice * (1 + 0.0005 * (i + 1));
    const askAmount = Math.random() * 10;
    askTotal += askAmount;
    asks.push({ price: askPrice, amount: askAmount, total: askTotal });

    const bidPrice = midPrice * (1 - 0.0005 * (i + 1));
    const bidAmount = Math.random() * 10;
    bidTotal += bidAmount;
    bids.push({ price: bidPrice, amount: bidAmount, total: bidTotal });
  }

  return { asks, bids };
}
