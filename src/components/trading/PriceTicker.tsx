import { useEffect, useState } from 'react';
import { Asset } from '@/types/trading';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface PriceTickerProps {
  assets: Asset[];
}

export function PriceTicker({ assets }: PriceTickerProps) {
  const [displayAssets, setDisplayAssets] = useState<Asset[]>([]);

  useEffect(() => {
    // Duplicate assets for seamless scrolling
    setDisplayAssets([...assets.slice(0, 10), ...assets.slice(0, 10)]);
  }, [assets]);

  if (displayAssets.length === 0) return null;

  return (
    <div className="w-full overflow-hidden bg-secondary/30 border-b border-border/50">
      <div className="animate-[scroll_30s_linear_infinite] flex whitespace-nowrap py-2">
        {displayAssets.map((asset, index) => (
          <div
            key={`${asset.id}-${index}`}
            className="inline-flex items-center gap-3 px-6 border-r border-border/30"
          >
            {asset.image && (
              <img src={asset.image} alt={asset.name} className="w-5 h-5 rounded-full" />
            )}
            <span className="font-medium text-foreground">{asset.symbol}</span>
            <span className="text-muted-foreground price-ticker">
              ${asset.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span 
              className={cn(
                "flex items-center gap-1 text-sm font-medium",
                asset.change24h >= 0 ? "text-success" : "text-destructive"
              )}
            >
              {asset.change24h >= 0 ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {asset.change24h >= 0 ? '+' : ''}{asset.change24h.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
