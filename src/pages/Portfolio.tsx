import { Navbar } from '@/components/trading/Navbar';
import { Button } from '@/components/ui/button';
import { Wallet, TrendingUp, TrendingDown, CreditCard, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

export default function Portfolio() {
  const holdings = [
    { asset: 'BTC', amount: 0.5, value: 33750, change: 2.5 },
    { asset: 'ETH', amount: 5.2, value: 17940, change: 1.8 },
    { asset: 'SOL', amount: 100, value: 14800, change: -1.2 },
    { asset: 'SCOM', amount: 5000, value: 132500, change: 3.5 },
  ];

  const totalValue = holdings.reduce((sum, h) => sum + h.value, 0);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-20 max-w-7xl mx-auto px-4">
        <h1 className="font-display text-4xl mb-8 text-gradient">Portfolio</h1>
        
        {/* Balance Card */}
        <div className="trading-panel mb-6 bg-gradient-to-br from-primary/10 to-accent/10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-muted-foreground">Total Balance</p>
              <p className="font-display text-4xl">${totalValue.toLocaleString()}</p>
            </div>
            <div className="flex gap-2">
              <Button className="bg-success hover:bg-success/90">
                <ArrowDownLeft className="w-4 h-4 mr-2" /> Deposit
              </Button>
              <Button variant="outline" className="border-primary text-primary">
                <ArrowUpRight className="w-4 h-4 mr-2" /> Withdraw
              </Button>
            </div>
          </div>
          
          {/* M-Pesa Integration */}
          <div className="p-4 rounded-lg bg-secondary/50 border border-success/30">
            <div className="flex items-center gap-3">
              <CreditCard className="w-8 h-8 text-success" />
              <div>
                <p className="font-semibold">M-Pesa Integration</p>
                <p className="text-sm text-muted-foreground">Deposit/Withdraw via M-Pesa (Sandbox Mode)</p>
              </div>
              <Button size="sm" className="ml-auto bg-success text-success-foreground">
                Connect M-Pesa
              </Button>
            </div>
          </div>
        </div>

        {/* Holdings */}
        <div className="trading-panel">
          <h3 className="font-display text-xl mb-4">Your Holdings</h3>
          <div className="space-y-3">
            {holdings.map(h => (
              <div key={h.asset} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary">
                    {h.asset.slice(0, 2)}
                  </div>
                  <div>
                    <p className="font-semibold">{h.asset}</p>
                    <p className="text-sm text-muted-foreground">{h.amount} tokens</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-mono">${h.value.toLocaleString()}</p>
                  <p className={`text-sm flex items-center justify-end gap-1 ${h.change >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {h.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {h.change >= 0 ? '+' : ''}{h.change}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
