import { Navbar } from '@/components/trading/Navbar';
import { Button } from '@/components/ui/button';
import { Landmark, Shield, AlertTriangle } from 'lucide-react';

const loanOptions = [
  { id: 1, collateral: 'BTC', borrow: 'USDC', ltv: 75, rate: 5.5, available: 50000000 },
  { id: 2, collateral: 'ETH', borrow: 'USDC', ltv: 80, rate: 4.8, available: 35000000 },
  { id: 3, collateral: 'SOL', borrow: 'USDC', ltv: 65, rate: 7.2, available: 12000000 },
];

export default function Loans() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-20 max-w-7xl mx-auto px-4">
        <h1 className="font-display text-4xl mb-2 text-gradient">Crypto Loans</h1>
        <p className="text-muted-foreground mb-8">Borrow against your crypto holdings</p>
        
        <div className="grid gap-4">
          {loanOptions.map(loan => (
            <div key={loan.id} className="trading-panel flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <Landmark className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-display text-lg">{loan.collateral} → {loan.borrow}</h3>
                  <p className="text-sm text-muted-foreground">Collateral to Borrow</p>
                </div>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold">{loan.ltv}%</p>
                <p className="text-xs text-muted-foreground">Max LTV</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-warning">{loan.rate}%</p>
                <p className="text-xs text-muted-foreground">APR</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold">${(loan.available / 1e6).toFixed(0)}M</p>
                <p className="text-xs text-muted-foreground">Available</p>
              </div>
              <Button className="ml-auto bg-primary/20 text-primary hover:bg-primary hover:text-primary-foreground">
                Borrow Now
              </Button>
            </div>
          ))}
        </div>
        
        <div className="mt-8 trading-panel border-warning/50">
          <div className="flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-warning shrink-0" />
            <div>
              <h4 className="font-semibold text-warning">Risk Disclaimer</h4>
              <p className="text-sm text-muted-foreground">
                Crypto loans involve significant risk. If your collateral value drops below the liquidation threshold, 
                your position may be automatically liquidated. Always maintain a healthy collateral ratio.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
