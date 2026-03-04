import { useState, useMemo } from 'react';
import { ChartData } from '@/types/trading';
import { cn } from '@/lib/utils';

interface TradingChartProps {
  data: ChartData[];
  loading?: boolean;
}

export function TradingChart({ data, loading }: TradingChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const dataLength = data.length;

  const chartMetrics = useMemo(() => {
    if (dataLength === 0) return null;

    const prices = data.map(d => d.close);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    const priceChange = ((data[dataLength - 1].close - data[0].close) / data[0].close) * 100;

    return { min, max, range, priceChange };
  }, [data, dataLength]);

  const pathData = useMemo(() => {
    if (dataLength === 0 || !chartMetrics) return '';

    const points = data.map((d, i) => {
      const x = (i / (dataLength - 1)) * 100;
      const y = 100 - ((d.close - chartMetrics.min) / chartMetrics.range) * 100;
      return `${x},${y}`;
    });

    return `M ${points.join(' L ')}`;
  }, [chartMetrics, data, dataLength]);

  const areaPath = useMemo(() => {
    if (dataLength === 0) return '';
    return `${pathData} L 100,100 L 0,100 Z`;
  }, [dataLength, pathData]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (dataLength === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
        No chart data available
      </div>
    );
  }

  const isPositive = chartMetrics && chartMetrics.priceChange >= 0;
  const strokeColor = isPositive ? 'hsl(145, 80%, 45%)' : 'hsl(0, 84%, 60%)';
  const fillColor = isPositive ? 'url(#greenGradient)' : 'url(#redGradient)';

  const hoveredData = hoveredIndex !== null ? data[hoveredIndex] : data[data.length - 1];

  return (
    <div className="relative w-full h-full">
      {/* Price info overlay */}
      <div className="absolute top-4 left-4 z-10">
        <div className="text-2xl font-mono font-bold text-foreground">
          ${hoveredData.close.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className={cn(
          "text-sm font-medium",
          isPositive ? "text-success" : "text-destructive"
        )}>
          {isPositive ? '+' : ''}{chartMetrics?.priceChange.toFixed(2)}%
        </div>
        {hoveredIndex !== null && (
          <div className="text-xs text-muted-foreground mt-1">
            {new Date(hoveredData.time).toLocaleString()}
          </div>
        )}
      </div>

      {/* OHLC info */}
      <div className="absolute top-4 right-4 z-10 text-right text-xs text-muted-foreground">
        <div className="flex gap-4">
          <span>O: <span className="text-foreground">${hoveredData.open.toFixed(2)}</span></span>
          <span>H: <span className="text-success">${hoveredData.high.toFixed(2)}</span></span>
          <span>L: <span className="text-destructive">${hoveredData.low.toFixed(2)}</span></span>
          <span>C: <span className="text-foreground">${hoveredData.close.toFixed(2)}</span></span>
        </div>
      </div>

      {/* SVG Chart */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="w-full h-full"
        onMouseLeave={() => setHoveredIndex(null)}
      >
        <defs>
          <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(145, 80%, 45%)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="hsl(145, 80%, 45%)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="redGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(0, 84%, 60%)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="hsl(0, 84%, 60%)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[25, 50, 75].map((y) => (
          <line
            key={y}
            x1="0"
            y1={y}
            x2="100"
            y2={y}
            stroke="hsl(180, 20%, 18%)"
            strokeWidth="0.2"
            strokeDasharray="2,2"
          />
        ))}

        {/* Area fill */}
        <path
          d={areaPath}
          fill={fillColor}
        />

        {/* Line */}
        <path
          d={pathData}
          fill="none"
          stroke={strokeColor}
          strokeWidth="0.5"
          vectorEffect="non-scaling-stroke"
        />

        {/* Interactive hover zones */}
        {data.map((d, i) => {
          const x = (i / (dataLength - 1)) * 100;
          const y = chartMetrics ? 100 - ((d.close - chartMetrics.min) / chartMetrics.range) * 100 : 0;
          
          return (
            <g key={i}>
              <rect
                x={x - 0.5}
                y="0"
                width="1"
                height="100"
                fill="transparent"
                onMouseEnter={() => setHoveredIndex(i)}
              />
              {hoveredIndex === i && (
                <>
                  <line
                    x1={x}
                    y1="0"
                    x2={x}
                    y2="100"
                    stroke={strokeColor}
                    strokeWidth="0.2"
                    strokeDasharray="1,1"
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r="1"
                    fill={strokeColor}
                  />
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
