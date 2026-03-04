import { Navbar } from '@/components/trading/Navbar';
import { Button } from '@/components/ui/button';
import { Droplets, TrendingUp, Lock } from 'lucide-react';

const pools = [
  { id: 1, pair: 'ETH/USDC', tvl: 125000000, apr: 12.5, volume: 8500000 },
  { id: 2, pair: 'BTC/ETH', tvl: 98000000, apr: 8.2, volume: 5200000 },
  { id: 3, pair: 'SOL/USDC', tvl: 45000000, apr: 18.7, volume: 3800000 },
  { id: 4, pair: 'SCOM/KES', tvl: 2500000, apr: 25.0, volume: 450000 },
];

export default function Pools() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-20 max-w-7xl mx-auto px-4">
        <h1 className="font-display text-4xl mb-2 text-gradient">Liquidity Pools</h1>
        <p className="text-muted-foreground mb-8">Provide liquidity and earn trading fees</p>
        
        <div className="grid gap-4">
          {pools.map(pool => (
            <div key={pool.id} className="trading-panel flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <Droplets className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-display text-lg">{pool.pair}</h3>
                  <p className="text-sm text-muted-foreground">TVL: ${(pool.tvl / 1e6).toFixed(1)}M</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-success font-bold">{pool.apr}% APR</p>
                <p className="text-xs text-muted-foreground">Vol: ${(pool.volume / 1e6).toFixed(1)}M</p>
              </div>
              <Button className="bg-primary/20 text-primary hover:bg-primary hover:text-primary-foreground">
                Add Liquidity
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
