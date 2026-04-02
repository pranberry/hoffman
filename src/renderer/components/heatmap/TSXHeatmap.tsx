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

// ── Sample Data ──

const SAMPLE_DATA: HeatmapData = {
  lastUpdated: 'Sample Data',
  tickerCount: 60,
  sectors: [
    {
      name: 'Financials',
      stocks: [
        { ticker: 'RY', name: 'Royal Bank of Canada', mcap: 236.5, weight: 6.79, changeDay: 0.85, changeMonth: 3.2, changeYear: 12.4 },
        { ticker: 'TD', name: 'Toronto-Dominion Bank', mcap: 165.2, weight: 4.64, changeDay: -0.42, changeMonth: -1.8, changeYear: -5.2 },
        { ticker: 'BMO', name: 'Bank of Montreal', mcap: 95.3, weight: 2.83, changeDay: 0.33, changeMonth: 2.1, changeYear: 8.7 },
        { ticker: 'BN', name: 'Brookfield Corp', mcap: 88.7, weight: 2.65, changeDay: 1.12, changeMonth: 5.4, changeYear: 22.1 },
        { ticker: 'CM', name: 'CIBC', mcap: 76.4, weight: 2.61, changeDay: -0.15, changeMonth: 0.8, changeYear: 15.3 },
        { ticker: 'BNS', name: 'Bank of Nova Scotia', mcap: 72.1, weight: 2.53, changeDay: 0.22, changeMonth: -2.4, changeYear: -8.1 },
        { ticker: 'MFC', name: 'Manulife Financial', mcap: 58.9, weight: 1.71, changeDay: 0.67, changeMonth: 4.3, changeYear: 18.9 },
        { ticker: 'NA', name: 'National Bank of Canada', mcap: 45.2, weight: 1.49, changeDay: 0.31, changeMonth: 1.9, changeYear: 11.2 },
        { ticker: 'SLF', name: 'Sun Life Financial', mcap: 40.1, weight: 1.02, changeDay: 0.45, changeMonth: 2.8, changeYear: 14.6 },
      ],
    },
    {
      name: 'Energy',
      stocks: [
        { ticker: 'ENB', name: 'Enbridge Inc', mcap: 118.2, weight: 3.5, changeDay: 0.41, changeMonth: 2.7, changeYear: 9.3 },
        { ticker: 'CNQ', name: 'Canadian Natural Resources', mcap: 101.3, weight: 3.01, changeDay: -1.23, changeMonth: -4.8, changeYear: -12.1 },
        { ticker: 'SU', name: 'Suncor Energy', mcap: 78.5, weight: 2.33, changeDay: -0.92, changeMonth: -3.2, changeYear: -7.5 },
        { ticker: 'TRP', name: 'TC Energy', mcap: 65.1, weight: 1.93, changeDay: 0.55, changeMonth: 3.8, changeYear: 15.4 },
        { ticker: 'CCO', name: 'Cameco Corp', mcap: 47.3, weight: 1.4, changeDay: 2.15, changeMonth: 8.9, changeYear: 35.2 },
        { ticker: 'CVE', name: 'Cenovus Energy', mcap: 35.8, weight: 1.06, changeDay: -1.55, changeMonth: -6.1, changeYear: -15.8 },
      ],
    },
    {
      name: 'Materials',
      stocks: [
        { ticker: 'AEM', name: 'Agnico Eagle Mines', mcap: 95.8, weight: 3.01, changeDay: 1.45, changeMonth: 7.2, changeYear: 28.9 },
        { ticker: 'ABX', name: 'Barrick Mining', mcap: 68.2, weight: 2.03, changeDay: 0.92, changeMonth: 5.1, changeYear: 18.3 },
        { ticker: 'WPM', name: 'Wheaton Precious Metals', mcap: 59.4, weight: 1.77, changeDay: 1.78, changeMonth: 9.3, changeYear: 32.5 },
        { ticker: 'NTR', name: 'Nutrien Ltd', mcap: 36.2, weight: 1.08, changeDay: -0.55, changeMonth: -3.8, changeYear: -11.2 },
      ],
    },
    {
      name: 'Information Technology',
      stocks: [
        { ticker: 'SHOP', name: 'Shopify Inc', mcap: 145.1, weight: 4.31, changeDay: 2.34, changeMonth: 11.2, changeYear: 42.8 },
        { ticker: 'CSU', name: 'Constellation Software', mcap: 34.9, weight: 1.04, changeDay: 0.78, changeMonth: 4.5, changeYear: 22.3 },
      ],
    },
    {
      name: 'Industrials',
      stocks: [
        { ticker: 'CP', name: 'Canadian Pacific Kansas City', mcap: 70.2, weight: 2.09, changeDay: 0.55, changeMonth: 2.8, changeYear: 14.2 },
        { ticker: 'CNR', name: 'Canadian National Railway', mcap: 55.8, weight: 1.66, changeDay: -0.28, changeMonth: -1.5, changeYear: 3.7 },
        { ticker: 'WCN', name: 'Waste Connections', mcap: 41.4, weight: 1.23, changeDay: 0.33, changeMonth: 2.1, changeYear: 11.8 },
      ],
    },
    {
      name: 'Communication Services',
      stocks: [
        { ticker: 'BCE', name: 'BCE Inc', mcap: 35.1, weight: 1.08, changeDay: -0.33, changeMonth: -5.2, changeYear: -18.4 },
        { ticker: 'T', name: 'Telus Corp', mcap: 28.7, weight: 0.94, changeDay: -0.21, changeMonth: -3.1, changeYear: -10.8 },
      ],
    },
    {
      name: 'Consumer Staples',
      stocks: [
        { ticker: 'ATD', name: 'Alimentation Couche-Tard', mcap: 42.1, weight: 1.25, changeDay: 0.22, changeMonth: 1.4, changeYear: 7.8 },
        { ticker: 'L', name: 'Loblaw Companies', mcap: 30.5, weight: 0.87, changeDay: 0.11, changeMonth: 2.3, changeYear: 15.1 },
      ],
    },
    {
      name: 'Utilities',
      stocks: [
        { ticker: 'FTS', name: 'Fortis Inc', mcap: 28.4, weight: 0.88, changeDay: 0.15, changeMonth: 1.8, changeYear: 8.2 },
        { ticker: 'H', name: 'Hydro One', mcap: 22.1, weight: 0.67, changeDay: 0.28, changeMonth: 2.5, changeYear: 14.1 },
      ],
    },
  ],
};

// ── Types for treemap ──

interface TreemapLeafData extends HeatmapStockData {
  sectorName: string;
  value: number;
}

type ChangeKey = 'changeDay' | 'changeMonth' | 'changeYear';

// ── Main Component ──

export function TSXHeatmap() {
  const [data, setData] = useState<HeatmapData | null>(null);
  const [period, setPeriod] = useState<'1D' | '1M' | '1Y'>('1D');
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
          setIsLive(true);
          setLoading(false);
        } else if (mounted) {
          setData(SAMPLE_DATA);
          setIsLive(false);
          setLoading(false);
        }
      } catch {
        if (mounted) {
          setData(SAMPLE_DATA);
          setIsLive(false);
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
    if (!selectedSector) return data;
    return { ...data, sectors: data.sectors.filter(s => s.name === selectedSector) };
  }, [data, selectedSector]);

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
            {isLive ? 'LIVE' : 'SAMPLE DATA'}
          </span>
          <span className="text-xs" style={{ color: '#666' }}>{data?.tickerCount} stocks</span>
          <span className="text-xs" style={{ color: '#666' }}>{data?.lastUpdated}</span>
        </div>
        <div className="flex gap-1">
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
                        {change >= 0 ? '+' : ''}{change.toFixed(2)}%
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
