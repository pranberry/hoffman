import { parse } from 'csv-parse/sync';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import type { HeatmapData, HeatmapStockData, HeatmapSectorData } from '../shared/types';

// Reuse the lazy yahoo-finance2 loader pattern from stocks.ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _yf: any;
async function getYahooFinance() {
  if (!_yf) {
    const mod = await import('yahoo-finance2');
    const YF = mod.default;
    _yf = typeof YF === 'function' ? new YF({ suppressNotices: ['yahooSurvey'] }) : YF;
  }
  return _yf;
}

// ── Types ──

interface Holding {
  ticker: string;
  yahooTicker: string;
  name: string;
  sector: string;
  weight: number;
}

// ── CSV Parsing ──

const BLACKROCK_CSV_URL =
  'https://www.blackrock.com/ca/investors/en/products/239837/ishares-sptsx-capped-composite-index-etf/1545043.ajax?tab=holdings&fileType=csv';

function getLocalCsvPath(): string {
  const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
  if (isDev) {
    // __dirname is dist/main/main
    return path.join(__dirname, '..', '..', '..', 'resources', 'XIC_holdings.csv');
  }
  return path.join(process.resourcesPath, 'XIC_holdings.csv');
}

function normalizeTicker(raw: string): { display: string; yahoo: string } {
  const t = raw.trim().replace(/"/g, '');
  if (/^\d+[A-Z]*$/.test(t)) return { display: t, yahoo: '' };
  const display = t;
  const yahoo = t.replace(/\./g, '-') + '.TO';
  return { display, yahoo };
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(' ')
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

function parseHoldingsCSV(csvText: string): Holding[] {
  const lines = csvText.split('\n');

  let headerIndex = -1;
  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    if (lines[i].includes('Ticker') && lines[i].includes('Name') && lines[i].includes('Sector')) {
      headerIndex = i;
      break;
    }
  }
  if (headerIndex === -1) throw new Error('Could not find CSV header row');

  const dataLines = lines.slice(headerIndex);
  const parsed = parse(dataLines.join('\n'), {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  });

  const holdings: Holding[] = [];
  for (const row of parsed as Record<string, string>[]) {
    const assetClass = (row['Asset Class'] || '').trim();
    if (assetClass !== 'Equity') continue;

    const rawTicker = (row['Ticker'] || '').trim();
    if (!rawTicker) continue;

    const { display, yahoo } = normalizeTicker(rawTicker);
    if (!yahoo) continue;

    holdings.push({
      ticker: display,
      yahooTicker: yahoo,
      name: titleCase(row['Name'] || ''),
      sector: (row['Sector'] || 'Unknown').trim(),
      weight: parseFloat((row['Weight (%)'] || '0').replace(/,/g, '')) || 0,
    });
  }

  return holdings;
}

async function loadHoldings(): Promise<Holding[]> {
  try {
    console.error('Fetching XIC holdings from BlackRock...');
    const resp = await fetch(BLACKROCK_CSV_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (resp.ok) {
      const text = await resp.text();
      const holdings = parseHoldingsCSV(text);
      if (holdings.length > 50) {
        console.error(`Loaded ${holdings.length} holdings from BlackRock CSV`);
        return holdings;
      }
    }
  } catch (e) {
    console.error('BlackRock CSV fetch failed:', (e as Error).message);
  }

  console.error('Falling back to local XIC_holdings.csv...');
  const text = fs.readFileSync(getLocalCsvPath(), 'utf-8');
  const holdings = parseHoldingsCSV(text);
  console.error(`Loaded ${holdings.length} holdings from local CSV`);
  return holdings;
}

// ── Yahoo Finance Data Fetching ──

async function fetchStockData(holding: Holding): Promise<HeatmapStockData | null> {
  try {
    const yf = await getYahooFinance();
    const now = new Date();
    const oneMonthAgo = new Date(now);
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const [quote, history] = await Promise.all([
      yf.quote(holding.yahooTicker),
      yf.chart(holding.yahooTicker, {
        period1: oneYearAgo.toISOString().split('T')[0],
        interval: '1d',
      }).catch(() => null),
    ]);

    const price = quote.regularMarketPrice ?? 0;
    const prevClose = quote.regularMarketPreviousClose ?? price;
    const changeDay = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
    const mcap = (quote.marketCap ?? 0) / 1e9;

    let changeMonth = 0;
    let changeYear = 0;

    if (history?.quotes && history.quotes.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const quotes = history.quotes.filter((q: any) => q.close != null);
      if (quotes.length > 0) {
        const yearAgoClose = quotes[0].close!;
        changeYear = yearAgoClose ? ((price - yearAgoClose) / yearAgoClose) * 100 : 0;

        const monthAgoTime = oneMonthAgo.getTime();
        let closestMonthQuote = quotes[0];
        let closestDiff = Infinity;
        for (const q of quotes) {
          const diff = Math.abs(new Date(q.date).getTime() - monthAgoTime);
          if (diff < closestDiff) {
            closestDiff = diff;
            closestMonthQuote = q;
          }
        }
        const monthAgoClose = closestMonthQuote.close!;
        changeMonth = monthAgoClose ? ((price - monthAgoClose) / monthAgoClose) * 100 : 0;
      }
    }

    return {
      ticker: holding.ticker,
      name: holding.name,
      price: Math.round(price * 100) / 100,
      mcap: Math.round(mcap * 100) / 100,
      weight: holding.weight,
      changeDay: Math.round(changeDay * 100) / 100,
      changeMonth: Math.round(changeMonth * 100) / 100,
      changeYear: Math.round(changeYear * 100) / 100,
    };
  } catch (e) {
    console.error(`Failed to fetch ${holding.yahooTicker}: ${(e as Error).message}`);
    return null;
  }
}

async function fetchAllStocks(holdings: Holding[], concurrency: number = 15): Promise<HeatmapStockData[]> {
  const results: HeatmapStockData[] = [];
  let index = 0;
  const total = holdings.length;
  fetchProgress = { current: 0, total };

  console.error(`Heatmap: fetching ${total} tickers...`);

  async function worker() {
    while (index < total) {
      const i = index++;
      const result = await fetchStockData(holdings[i]);
      if (result) results.push(result);
      fetchProgress.current++;
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, total) }, () => worker());
  await Promise.all(workers);

  console.error(`Heatmap: done fetching ${results.length} tickers`);
  return results;
}

// ── Cache ──

let cachedData: HeatmapData | null = null;
let cacheTime: Date | null = null;
let holdings: Holding[] = [];
let isFetching = false;
let fetchProgress = { current: 0, total: 0 };

const CACHE_TTL_MS = 5 * 60 * 1000;

function groupBySector(stocks: HeatmapStockData[], holdingsList: Holding[]): HeatmapSectorData[] {
  const sectorMap = new Map<string, string>();
  for (const h of holdingsList) {
    sectorMap.set(h.ticker, h.sector);
  }

  const sectors = new Map<string, HeatmapStockData[]>();
  for (const stock of stocks) {
    const sector = sectorMap.get(stock.ticker) || 'Unknown';
    if (!sectors.has(sector)) sectors.set(sector, []);
    sectors.get(sector)!.push(stock);
  }

  return Array.from(sectors.entries())
    .map(([name, sectorStocks]) => ({
      name,
      stocks: sectorStocks.sort((a, b) => b.mcap - a.mcap),
    }))
    .sort((a, b) => {
      const totalA = a.stocks.reduce((s, st) => s + st.mcap, 0);
      const totalB = b.stocks.reduce((s, st) => s + st.mcap, 0);
      return totalB - totalA;
    });
}

function formatTimestamp(): string {
  return new Date().toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
    timeZone: 'America/Toronto',
  });
}

async function refreshData(): Promise<void> {
  if (isFetching) return;
  isFetching = true;

  try {
    if (holdings.length === 0) {
      holdings = await loadHoldings();
    }

    const stocks = await fetchAllStocks(holdings);
    const sectors = groupBySector(stocks, holdings);

    cachedData = {
      lastUpdated: formatTimestamp(),
      tickerCount: stocks.length,
      sectors,
    };
    cacheTime = new Date();
    console.error(`Heatmap cache refreshed at ${cachedData.lastUpdated} with ${stocks.length} stocks`);
  } catch (e) {
    console.error('Heatmap error refreshing data:', (e as Error).message);
  } finally {
    isFetching = false;
  }
}

// ── Public API ──

function loadHoldingsFromLocal(): Holding[] {
  try {
    const text = fs.readFileSync(getLocalCsvPath(), 'utf-8');
    return parseHoldingsCSV(text);
  } catch (e) {
    console.error('Failed to load local holdings:', (e as Error).message);
    return [];
  }
}

export function getStructuralData(): HeatmapData | null {
  const localHoldings = loadHoldingsFromLocal();
  if (localHoldings.length === 0) return null;

  const stocks: HeatmapStockData[] = localHoldings.map((h) => ({
    ticker: h.ticker,
    name: h.name,
    price: 0,
    mcap: Math.round(h.weight * 10 * 100) / 100, // proportional placeholder
    weight: h.weight,
    changeDay: 0,
    changeMonth: 0,
    changeYear: 0,
  }));

  const sectors = groupBySector(stocks, localHoldings);

  return {
    lastUpdated: 'Loading live data...',
    tickerCount: stocks.length,
    sectors,
    progress: fetchProgress.total > 0 ? fetchProgress : undefined,
  };
}

export async function getHeatmapData(): Promise<HeatmapData | null> {
  if (!cachedData || !cacheTime || Date.now() - cacheTime.getTime() > CACHE_TTL_MS) {
    if (!isFetching) {
      refreshData();
    }
  }

  if (cachedData) return cachedData;

  const structural = getStructuralData();
  if (structural && isFetching) {
    structural.progress = fetchProgress;
  }
  return structural;
}

export function startHeatmapRefresh(): void {
  refreshData();
  setInterval(() => {
    console.error('Heatmap: scheduled refresh...');
    refreshData();
  }, CACHE_TTL_MS);
}
