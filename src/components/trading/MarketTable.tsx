import { useState } from 'react';
import { Asset } from '@/types/trading';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Star, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface MarketTableProps {
  assets: Asset[];
  title: string;
  onAssetSelect?: (asset: Asset) => void;
  loading?: boolean;
}

export function MarketTable({ assets, title, onAssetSelect, loading }: MarketTableProps) {
  const [search, setSearch] = useState('');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'marketCap' | 'change24h' | 'volume24h'>('marketCap');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const filteredAssets = assets
    .filter(asset => 
      asset.name.toLowerCase().includes(search.toLowerCase()) ||
      asset.symbol.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });

  const toggleFavorite = (id: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(id)) {
      newFavorites.delete(id);
    } else {
      newFavorites.add(id);
    }
    setFavorites(newFavorites);
  };

  const handleSort = (field: 'marketCap' | 'change24h' | 'volume24h') => {
    if (sortBy === field) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    return `$${num.toLocaleString()}`;
  };

  const formatPrice = (price: number) => {
    if (price >= 1000) return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (price >= 1) return price.toFixed(2);
    if (price >= 0.01) return price.toFixed(4);
    return price.toFixed(6);
  };

  return (
    <div className="trading-panel">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg text-foreground">{title}</h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-48 bg-secondary/50 border-border/50"
          />
        </div>
      </div>

      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50 text-muted-foreground text-sm">
              <th className="text-left py-3 px-2 w-8"></th>
              <th className="text-left py-3 px-2">#</th>
              <th className="text-left py-3 px-2">Asset</th>
              <th className="text-right py-3 px-2">Price</th>
              <th 
                className="text-right py-3 px-2 cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('change24h')}
              >
                24h %
              </th>
              <th 
                className="text-right py-3 px-2 cursor-pointer hover:text-foreground transition-colors hidden sm:table-cell"
                onClick={() => handleSort('volume24h')}
              >
                Volume
              </th>
              <th 
                className="text-right py-3 px-2 cursor-pointer hover:text-foreground transition-colors hidden md:table-cell"
                onClick={() => handleSort('marketCap')}
              >
                Market Cap
              </th>
              <th className="text-right py-3 px-2 hidden lg:table-cell">Trade</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array(5).fill(0).map((_, i) => (
                <tr key={i} className="border-b border-border/30">
                  <td colSpan={8} className="py-4">
                    <div className="h-8 bg-secondary/50 rounded animate-pulse"></div>
                  </td>
                </tr>
              ))
            ) : filteredAssets.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-muted-foreground">
                  No assets found
                </td>
              </tr>
            ) : (
              filteredAssets.map((asset, index) => (
                <tr 
                  key={asset.id}
                  className="border-b border-border/30 hover:bg-secondary/30 transition-colors cursor-pointer"
                  onClick={() => onAssetSelect?.(asset)}
                >
                  <td className="py-3 px-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(asset.id); }}
                      className="text-muted-foreground hover:text-warning transition-colors"
                    >
                      <Star 
                        className={cn(
                          "w-4 h-4",
                          favorites.has(asset.id) && "fill-warning text-warning"
                        )} 
                      />
                    </button>
                  </td>
                  <td className="py-3 px-2 text-muted-foreground text-sm">{index + 1}</td>
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-3">
                      {asset.image ? (
                        <img src={asset.image} alt={asset.name} className="w-8 h-8 rounded-full" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                          <span className="text-xs font-bold text-primary">{asset.symbol.slice(0, 2)}</span>
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-foreground">{asset.symbol}</p>
                        <p className="text-xs text-muted-foreground">{asset.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-right font-mono text-foreground">
                    ${formatPrice(asset.price)}
                  </td>
                  <td className="py-3 px-2 text-right">
                    <span 
                      className={cn(
                        "inline-flex items-center gap-1 font-medium",
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
                  </td>
                  <td className="py-3 px-2 text-right text-muted-foreground hidden sm:table-cell">
                    {formatNumber(asset.volume24h)}
                  </td>
                  <td className="py-3 px-2 text-right text-muted-foreground hidden md:table-cell">
                    {formatNumber(asset.marketCap)}
                  </td>
                  <td className="py-3 px-2 text-right hidden lg:table-cell">
                    <Button 
                      size="sm" 
                      className="bg-primary/20 text-primary hover:bg-primary hover:text-primary-foreground"
                      onClick={(e) => { e.stopPropagation(); onAssetSelect?.(asset); }}
                    >
                      Trade
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
