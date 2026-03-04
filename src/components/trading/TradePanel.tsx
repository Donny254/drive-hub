import { useState } from 'react';
import { Asset } from '@/types/trading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Wallet, ArrowDownUp, Info } from 'lucide-react';

interface TradePanelProps {
  asset: Asset;
  balance?: { base: number; quote: number };
}

export function TradePanel({ asset, balance = { base: 0.5, quote: 10000 } }: TradePanelProps) {
  const [orderType, setOrderType] = useState<'limit' | 'market'>('limit');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [price, setPrice] = useState(String(asset.price));
  const [amount, setAmount] = useState('');
  const [sliderValue, setSliderValue] = useState([0]);
  const [leverage, setLeverage] = useState(1);

  const total = parseFloat(amount || '0') * parseFloat(price || '0');
  const maxBuy = balance.quote / parseFloat(price || String(asset.price));
  const maxSell = balance.base;

  const handleSliderChange = (value: number[]) => {
    setSliderValue(value);
    const max = side === 'buy' ? maxBuy : maxSell;
    setAmount((max * value[0] / 100).toFixed(6));
  };

  const handleAmountChange = (value: string) => {
    setAmount(value);
    const max = side === 'buy' ? maxBuy : maxSell;
    if (max > 0) {
      setSliderValue([Math.min((parseFloat(value || '0') / max) * 100, 100)]);
    }
  };

  const percentButtons = [25, 50, 75, 100];

  return (
    <div className="trading-panel h-full flex flex-col">
      <Tabs defaultValue="spot" className="w-full">
        <TabsList className="w-full bg-secondary/50 mb-4">
          <TabsTrigger value="spot" className="flex-1">Spot</TabsTrigger>
          <TabsTrigger value="margin" className="flex-1">Margin</TabsTrigger>
          <TabsTrigger value="futures" className="flex-1">Futures</TabsTrigger>
        </TabsList>

        <TabsContent value="spot" className="mt-0">
          {/* Buy/Sell Toggle */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <Button
              variant={side === 'buy' ? 'default' : 'outline'}
              className={cn(
                "font-semibold transition-all",
                side === 'buy' 
                  ? "bg-success text-success-foreground hover:bg-success/90" 
                  : "border-success/50 text-success hover:bg-success/10"
              )}
              onClick={() => setSide('buy')}
            >
              Buy
            </Button>
            <Button
              variant={side === 'sell' ? 'default' : 'outline'}
              className={cn(
                "font-semibold transition-all",
                side === 'sell' 
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" 
                  : "border-destructive/50 text-destructive hover:bg-destructive/10"
              )}
              onClick={() => setSide('sell')}
            >
              Sell
            </Button>
          </div>

          {/* Order Type */}
          <div className="flex gap-2 mb-4">
            <button
              className={cn(
                "text-sm px-3 py-1.5 rounded-lg transition-all",
                orderType === 'limit' 
                  ? "bg-primary/20 text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setOrderType('limit')}
            >
              Limit
            </button>
            <button
              className={cn(
                "text-sm px-3 py-1.5 rounded-lg transition-all",
                orderType === 'market' 
                  ? "bg-primary/20 text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setOrderType('market')}
            >
              Market
            </button>
          </div>

          {/* Price Input */}
          {orderType === 'limit' && (
            <div className="mb-3">
              <label className="text-xs text-muted-foreground mb-1 block">Price (USD)</label>
              <Input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="bg-secondary/50 border-border/50 font-mono"
                placeholder="0.00"
              />
            </div>
          )}

          {/* Amount Input */}
          <div className="mb-3">
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs text-muted-foreground">Amount ({asset.symbol})</label>
              <span className="text-xs text-muted-foreground">
                Available: {side === 'buy' ? `$${balance.quote.toLocaleString()}` : `${balance.base} ${asset.symbol}`}
              </span>
            </div>
            <Input
              type="number"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              className="bg-secondary/50 border-border/50 font-mono"
              placeholder="0.00"
            />
          </div>

          {/* Slider */}
          <div className="mb-4">
            <Slider
              value={sliderValue}
              onValueChange={handleSliderChange}
              max={100}
              step={1}
              className="my-3"
            />
            <div className="flex justify-between gap-2">
              {percentButtons.map((percent) => (
                <button
                  key={percent}
                  onClick={() => handleSliderChange([percent])}
                  className="flex-1 text-xs py-1.5 rounded bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-all"
                >
                  {percent}%
                </button>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="p-3 rounded-lg bg-secondary/30 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="font-mono font-semibold">${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* Submit Button */}
          <Button
            className={cn(
              "w-full font-semibold text-lg py-6 transition-all",
              side === 'buy'
                ? "bg-success hover:bg-success/90 text-success-foreground"
                : "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            )}
          >
            {side === 'buy' ? 'Buy' : 'Sell'} {asset.symbol}
          </Button>

          {/* Fee Info */}
          <div className="mt-4 p-3 rounded-lg bg-secondary/20 border border-border/30">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <Info className="w-3 h-3" />
              <span>Fee Information</span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Maker Fee</span>
                <span className="text-primary">0.02%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Taker Fee</span>
                <span className="text-primary">0.05%</span>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="margin" className="mt-0">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ArrowDownUp className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">Margin Trading</h3>
            <p className="text-sm text-muted-foreground">Coming soon. Trade with up to 10x leverage.</p>
          </div>
        </TabsContent>

        <TabsContent value="futures" className="mt-0">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Wallet className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">Futures Trading</h3>
            <p className="text-sm text-muted-foreground">Coming soon. Perpetual contracts with up to 100x leverage.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
