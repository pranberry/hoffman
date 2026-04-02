import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import type { HeatmapData, HeatmapStockData } from '../../../shared/types';

// ── Configuration ──

const REFRESH_INTERVAL = 5 * 60 * 1000;

// ── Color Scales ──

const COLOR_CAPS: Record<string, number> = { '1D': 4, '1M': 15, '1Y': 30 };

function getColor(change: number, period: string): string {
  const cap = COLOR_CAPS[period];
  const clamped = Math.max(-cap, Math.min(cap, change));
  const t = clamped / cap;

  if (Math.abs(t) < 0.01) return '#2a2a35';

  if (t > 0) {
    const r = Math.round(20 + (0 - 20) * t);
    const g = Math.round(30 + (160 - 30) * t);
    const b = Math.round(25 + (50 - 25) * t);
    return `rgb(${r},${g},${b})`;
  } else {
    const absT = -t;
    const r = Math.round(30 + (200 - 30) * absT);
    const g = Math.round(20 + (20 - 20) * absT);
    const b = Math.round(25 + (30 - 25) * absT);
    return `rgb(${r},${g},${b})`;
  }
}

function getTextColor(change: number, period: string): string {
  const cap = COLOR_CAPS[period];
  return Math.abs(change) > cap * 0.15 ? '#ffffff' : '#bbbbbb';
}

type ChangeKey = 'changeDay' | 'changeMonth' | 'changeYear';

// ── Main Component ──

export function TSXHeatmap() {
  const [data, setData] = useState<HeatmapData | null>(null);
  const [period, setPeriod] = useState<'1D' | '1M' | '1Y'>('1D');
  const [showAll, setShowAll] = useState(true);
  const [showPrice, setShowPrice] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hoveredStock, setHoveredStock] = useState<HeatmapStockData | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [selectedSector, setSelectedSector] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function fetchData() {
      try {
        const result = await window.api.heatmap.getData();
        if (mounted && result) {
          setData(result);
          setIsLive(result.lastUpdated !== 'Loading live data...');
          setLoading(false);
        }
      } catch (e) {
        console.error('Failed to fetch heatmap data:', e);
        if (mounted) {
          setLoading(false);
        }
      }
    }
    fetchData();
    const interval = setInterval(fetchData, REFRESH_INTERVAL);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [loading]);

  const changeKey: ChangeKey = period === '1D' ? 'changeDay' : period === '1M' ? 'changeMonth' : 'changeYear';

  const filteredData = useMemo(() => {
    if (!data) return null;
    
    let baseSectors = data.sectors;
    
    // Top 60 filtering logic
    if (!showAll) {
      const allStocks = data.sectors.flatMap(s => s.stocks.map(st => ({ ...st, sectorName: s.name })));
      const top60 = allStocks.sort((a, b) => b.weight - a.weight).slice(0, 60);
      
      const sectorMap = new Map<string, HeatmapStockData[]>();
      top60.forEach(st => {
        const sectorName = (st as any).sectorName;
        if (!sectorMap.has(sectorName)) sectorMap.set(sectorName, []);
        sectorMap.get(sectorName)!.push(st);
      });
      
      baseSectors = Array.from(sectorMap.entries()).map(([name, stocks]) => ({
        name,
        stocks: stocks.sort((a, b) => b.mcap - a.mcap)
      })).sort((a, b) => {
        const totalA = a.stocks.reduce((s, st) => s + st.mcap, 0);
        const totalB = b.stocks.reduce((s, st) => s + st.mcap, 0);
        return totalB - totalA;
      });
    }

    if (!selectedSector) return { ...data, sectors: baseSectors };
    return { ...data, sectors: baseSectors.filter(s => s.name === selectedSector) };
  }, [data, selectedSector, showAll]);

  const displayCount = useMemo(() => {
    return filteredData?.sectors.reduce((sum, s) => sum + s.stocks.length, 0) || 0;
  }, [filteredData]);

  const treemapData = useMemo(() => {
    if (!filteredData || dimensions.width === 0) return null;
    const isSingle = filteredData.sectors.length === 1;

    const root = d3
      .hierarchy({
        name: 'root',
        children: filteredData.sectors.map((sector) => ({
          name: sector.name,
          children: sector.stocks.map((s) => ({
            ...s,
            sectorName: sector.name,
            value: Math.max(s.mcap, 0.01),
          })),
        })),
      })
      .sum((d: any) => d.value || 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    d3.treemap<any>()
      .size([dimensions.width, dimensions.height])
      .padding(1)
      .paddingTop(isSingle ? 2 : 18)
      .paddingOuter(2)
      .tile(d3.treemapSquarify.ratio(1.2))(root);

    return root;
  }, [filteredData, dimensions]);

  const sectorSummaries = useMemo(() => {
    if (!data) return [];
    return data.sectors
      .map((sector) => {
        const totalWeight = sector.stocks.reduce((s, st) => s + st.weight, 0);
        const weightedChange = totalWeight > 0
          ? sector.stocks.reduce((s, st) => s + st[changeKey] * st.weight, 0) / totalWeight
          : 0;
        return { name: sector.name, change: Math.round(weightedChange * 100) / 100 };
      })
      .sort((a, b) => b.change - a.change);
  }, [data, changeKey]);

  const indexChange = useMemo(() => {
    if (!data) return 0;
    let totalWeight = 0;
    let weightedSum = 0;
    for (const sector of data.sectors) {
      for (const stock of sector.stocks) {
        totalWeight += stock.weight;
        weightedSum += stock[changeKey] * stock.weight;
      }
    }
    return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : 0;
  }, [data, changeKey]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  }, []);

  const tooltipPos = useMemo(() => {
    const tt = tooltipRef.current;
    if (!tt) return { left: mousePos.x + 15, top: mousePos.y - 10 };
    const tw = tt.offsetWidth;
    const th = tt.offsetHeight;
    const gap = 15;
    let left = mousePos.x + gap;
    let top = mousePos.y - 10;
    if (left + tw > window.innerWidth - 8) left = mousePos.x - tw - gap;
    if (top + th > window.innerHeight - 8) top = window.innerHeight - th - 8;
    if (top < 8) top = 8;
    return { left, top };
  }, [mousePos]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center" style={{ background: '#0a0a0f' }}>
        <div className="text-gray-500 text-sm">Loading TSX data...</div>
      </div>
    );
  }

  const sectorNodes = treemapData ? treemapData.children || [] : [];

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden"
      style={{ background: '#0a0a0f', color: '#e0e0e0', fontFamily: "'Inter', system-ui, sans-serif" }}
      onMouseMove={handleMouseMove}
    >
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-2 flex-shrink-0" style={{ borderBottom: '1px solid #1a1a2e' }}>
        <div className="flex items-center gap-3">
          <span className="text-base font-semibold text-white">S&P/TSX Composite</span>
          <span className="text-sm font-bold font-mono" style={{ color: indexChange >= 0 ? '#22c55e' : '#ef4444' }}>
            {indexChange >= 0 ? '+' : ''}{indexChange.toFixed(2)}%
          </span>
          <span className="text-xs flex items-center gap-1" style={{ color: '#aaa' }}>
            <span style={{ color: isLive ? '#22c55e' : '#f59e0b', fontSize: 10 }}>●</span>
            {isLive ? 'LIVE' : (
              <span className="flex items-center gap-2">
                WAITING
                {data?.progress && (
                  <span className="flex items-center gap-1.5">
                    <span style={{ color: '#666' }}>({Math.round((data.progress.current / data.progress.total) * 100)}%)</span>
                    <div style={{ width: 40, height: 4, background: '#1a1a2e', borderRadius: 2, overflow: 'hidden' }}>
                      <div 
                        style={{ 
                          width: `${(data.progress.current / data.progress.total) * 100}%`, 
                          height: '100%', 
                          background: '#f59e0b',
                          transition: 'width 0.3s ease-out'
                        }} 
                      />
                    </div>
                  </span>
                )}
              </span>
            )}
          </span>
          <span className="text-xs" style={{ color: '#666' }}>{displayCount} stocks</span>
          <span className="text-xs" style={{ color: '#666' }}>{data?.lastUpdated}</span>
        </div>
        <div className="flex gap-1 items-center">
          <div className="flex gap-1 mr-4" style={{ background: '#1a1a2e', padding: '2px', borderRadius: '4px', border: '1px solid #2a2a3e' }}>
            <button
              onClick={() => setShowAll(true)}
              className="px-3 py-0.5 rounded text-[10px] font-bold uppercase cursor-pointer transition-all"
              style={{ 
                background: showAll ? '#2a2a4e' : 'transparent',
                color: showAll ? '#fff' : '#666'
              }}
            >
              All
            </button>
            <button
              onClick={() => setShowAll(false)}
              className="px-3 py-0.5 rounded text-[10px] font-bold uppercase cursor-pointer transition-all"
              style={{ 
                background: !showAll ? '#2a2a4e' : 'transparent',
                color: !showAll ? '#fff' : '#666'
              }}
            >
              Top 60
            </button>
          </div>
          {(['1D', '1M', '1Y'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="px-3 py-1 rounded text-xs font-semibold font-mono cursor-pointer transition-all"
              style={{
                background: period === p ? '#2a2a4e' : '#1a1a2e',
                border: `1px solid ${period === p ? '#4a4a6e' : '#2a2a3e'}`,
                color: period === p ? '#fff' : '#888',
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Sector summary bar */}
      <div className="flex gap-1.5 px-4 py-1.5 overflow-x-auto flex-shrink-0" style={{ borderBottom: '1px solid #1a1a2e' }}>
        <div
          onClick={() => setSelectedSector(null)}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded cursor-pointer flex-shrink-0"
          style={{
            backgroundColor: !selectedSector ? '#2a2a4e' : '#1a1a2e',
            border: `1px solid ${!selectedSector ? '#4a4a6e' : '#2a2a3e'}`,
          }}
        >
          <span className="text-xs font-medium" style={{ color: !selectedSector ? '#fff' : '#888', fontWeight: 600 }}>All</span>
        </div>
        {sectorSummaries.map((s) => (
          <div
            key={s.name}
            onClick={() => setSelectedSector(selectedSector === s.name ? null : s.name)}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded cursor-pointer flex-shrink-0 whitespace-nowrap"
            style={{
              backgroundColor: getColor(s.change, period),
              outline: selectedSector === s.name ? '2px solid #fff' : 'none',
              outlineOffset: -1,
            }}
          >
            <span className="text-xs font-medium" style={{ color: '#ccc' }}>{s.name}</span>
            <span className="font-mono text-xs" style={{ color: s.change >= 0 ? '#4ade80' : '#f87171' }}>
              {s.change >= 0 ? '+' : ''}{s.change.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>

      {/* Treemap */}
      <div ref={containerRef} className="flex-1 overflow-hidden relative">
        {treemapData && dimensions.width > 0 && (
          <svg width={dimensions.width} height={dimensions.height} style={{ display: 'block' }}>
            {/* Sector backgrounds and labels */}
            {!selectedSector && sectorNodes.map((sector: any) => (
              <g key={sector.data.name}>
                <rect
                  x={sector.x0}
                  y={sector.y0}
                  width={sector.x1 - sector.x0}
                  height={sector.y1 - sector.y0}
                  fill="none"
                  stroke="#1a1a2e"
                  strokeWidth={2}
                />
                <text
                  x={sector.x0 + 4}
                  y={sector.y0 + 13}
                  fill="#888"
                  fontSize={11}
                  fontWeight={600}
                >
                  {sector.data.name}
                </text>
              </g>
            ))}

            {/* Stock cells */}
            {sectorNodes.flatMap((sector: any) =>
              (sector.children || []).map((leaf: any) => {
                const w = leaf.x1 - leaf.x0;
                const h = leaf.y1 - leaf.y0;
                const change = leaf.data[changeKey];
                const bg = getColor(change, period);
                const fg = getTextColor(change, period);
                const showTicker = w > 28 && h > 16;
                const showChange = w > 36 && h > 28;

                return (
                  <g
                    key={leaf.data.ticker}
                    onMouseEnter={() => setHoveredStock(leaf.data)}
                    onMouseLeave={() => setHoveredStock(null)}
                    onClick={() => setShowPrice(!showPrice)}
                    style={{ cursor: 'pointer' }}
                  >
                    <rect
                      x={leaf.x0}
                      y={leaf.y0}
                      width={w}
                      height={h}
                      fill={bg}
                      stroke="#0a0a0f"
                      strokeWidth={0.5}
                      rx={1}
                    />
                    {showTicker && (
                      <text
                        x={leaf.x0 + w / 2}
                        y={leaf.y0 + h / 2 + (showChange ? -4 : 3)}
                        fill={fg}
                        fontSize={Math.min(12, Math.max(8, w / 6))}
                        fontFamily="monospace"
                        fontWeight={700}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        style={{ pointerEvents: 'none' }}
                      >
                        {leaf.data.ticker}
                      </text>
                    )}
                    {showChange && (
                      <text
                        x={leaf.x0 + w / 2}
                        y={leaf.y0 + h / 2 + 10}
                        fill={fg}
                        fontSize={Math.min(10, Math.max(7, w / 8))}
                        fontFamily="monospace"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        style={{ pointerEvents: 'none', opacity: 0.9 }}
                      >
                        {showPrice ? `$${leaf.data.price.toFixed(2)}` : `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`}
                      </text>
                    )}
                  </g>
                );
              })
            )}
          </svg>
        )}
      </div>

      {/* Tooltip */}
      {hoveredStock && (
        <div
          ref={tooltipRef}
          className="fixed pointer-events-none z-50 rounded-md"
          style={{
            background: 'rgba(10, 10, 20, 0.95)',
            border: '1px solid #333',
            padding: '10px 14px',
            minWidth: 180,
            backdropFilter: 'blur(8px)',
            left: tooltipPos.left,
            top: tooltipPos.top,
          }}
        >
          <div className="text-base font-bold font-mono text-white">{hoveredStock.ticker}</div>
          <div className="text-xs mb-1.5" style={{ color: '#999' }}>{hoveredStock.name}</div>
          <div style={{ borderTop: '1px solid #333', margin: '6px 0' }} />
          <div className="flex justify-between text-xs font-mono py-0.5" style={{ color: '#bbb' }}>
            <span>Price</span>
            <span>${hoveredStock.price.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs font-mono py-0.5" style={{ color: '#bbb' }}>
            <span>Market Cap</span>
            <span>${hoveredStock.mcap.toFixed(1)}B</span>
          </div>
          <div className="flex justify-between text-xs font-mono py-0.5" style={{ color: '#bbb' }}>
            <span>Weight</span>
            <span>{hoveredStock.weight.toFixed(2)}%</span>
          </div>
          <div style={{ borderTop: '1px solid #333', margin: '6px 0' }} />
          <div className="flex justify-between text-xs font-mono py-0.5" style={{ color: hoveredStock.changeDay >= 0 ? '#4ade80' : '#f87171' }}>
            <span>1D</span>
            <span>{hoveredStock.changeDay >= 0 ? '+' : ''}{hoveredStock.changeDay.toFixed(2)}%</span>
          </div>
          <div className="flex justify-between text-xs font-mono py-0.5" style={{ color: hoveredStock.changeMonth >= 0 ? '#4ade80' : '#f87171' }}>
            <span>1M</span>
            <span>{hoveredStock.changeMonth >= 0 ? '+' : ''}{hoveredStock.changeMonth.toFixed(2)}%</span>
          </div>
          <div className="flex justify-between text-xs font-mono py-0.5" style={{ color: hoveredStock.changeYear >= 0 ? '#4ade80' : '#f87171' }}>
            <span>1Y</span>
            <span>{hoveredStock.changeYear >= 0 ? '+' : ''}{hoveredStock.changeYear.toFixed(2)}%</span>
          </div>
        </div>
      )}
    </div>
  );
}
