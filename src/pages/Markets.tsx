import { Navbar } from '@/components/trading/Navbar';
import { MarketTable } from '@/components/trading/MarketTable';
import { useMarketData } from '@/hooks/useMarketData';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function Markets() {
  const { cryptoAssets, nseAssets, stockAssets, cryptoDataSource, loading, error } = useMarketData();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-20 max-w-7xl mx-auto px-4">
        <h1 className="font-display text-4xl mb-8 text-gradient">All Markets</h1>

        {cryptoDataSource === "demo" && (
          <Alert className="mb-6 border-amber-500/30 bg-amber-500/10 text-amber-100">
            <AlertTitle>Demo market data</AlertTitle>
            <AlertDescription>
              {error || "Live crypto pricing is unavailable right now. The values shown in this tab are demo fallback data and should not be treated as live market prices."}
            </AlertDescription>
          </Alert>
        )}
        
        <Tabs defaultValue="crypto" className="w-full">
          <TabsList className="bg-secondary/50 mb-6">
            <TabsTrigger value="crypto">🌐 Crypto</TabsTrigger>
            <TabsTrigger value="nse">🇰🇪 NSE Kenya</TabsTrigger>
            <TabsTrigger value="global">🌍 Global Stocks</TabsTrigger>
          </TabsList>
          
          <TabsContent value="crypto">
            <MarketTable assets={cryptoAssets} title="Cryptocurrency Markets" loading={loading} />
          </TabsContent>
          
          <TabsContent value="nse">
            <MarketTable assets={nseAssets} title="Nairobi Stock Exchange (Tokenized)" />
          </TabsContent>
          
          <TabsContent value="global">
            <MarketTable assets={stockAssets} title="Global Markets" />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
