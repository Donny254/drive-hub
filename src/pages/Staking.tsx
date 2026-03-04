import { Navbar } from '@/components/trading/Navbar';
import { Button } from '@/components/ui/button';
import { Coins, Lock, Gift } from 'lucide-react';

const stakingPools = [
  { id: 1, asset: 'ETH', apy: 4.5, staked: 150000, minStake: 0.1, lockDays: 0 },
  { id: 2, asset: 'SOL', apy: 7.2, staked: 85000, minStake: 1, lockDays: 30 },
  { id: 3, asset: 'BNB', apy: 5.8, staked: 42000, minStake: 0.5, lockDays: 14 },
  { id: 4, asset: 'ADA', apy: 3.5, staked: 2500000, minStake: 100, lockDays: 0 },
];

export default function Staking() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-20 max-w-7xl mx-auto px-4">
        <h1 className="font-display text-4xl mb-2 text-gradient">Staking</h1>
        <p className="text-muted-foreground mb-8">Stake your assets and earn rewards</p>
        
        <div className="grid md:grid-cols-2 gap-4">
          {stakingPools.map(pool => (
            <div key={pool.id} className="trading-panel">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <Coins className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-display text-xl">{pool.asset}</h3>
                  <p className="text-xs text-muted-foreground">
                    {pool.lockDays > 0 ? `${pool.lockDays} days lock` : 'Flexible'}
                  </p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-2xl font-bold text-success">{pool.apy}%</p>
                  <p className="text-xs text-muted-foreground">APY</p>
                </div>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground mb-4">
                <span>Total Staked: {pool.staked.toLocaleString()} {pool.asset}</span>
                <span>Min: {pool.minStake} {pool.asset}</span>
              </div>
              <Button className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground">
                Stake {pool.asset}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
