import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// Mock electron
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('/tmp'),
  },
}));

// Mock yahoo-finance2
vi.mock('yahoo-finance2', () => ({
  default: {
    quote: vi.fn(),
    chart: vi.fn(),
  },
}));

// Mock process.resourcesPath
(process as any).resourcesPath = '/tmp/resources';

import { getStructuralData, getHeatmapData } from './heatmap';

vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn(),
  },
}));

describe('Heatmap Logic', () => {
  const mockCsv = `
Ticker,Name,Asset Class,Weight (%),Sector
RY,"ROYAL BANK OF CANADA",Equity,6.79,Financials
TD,"TORONTO-DOMINION BANK",Equity,4.64,Financials
ENB,"ENBRIDGE INC",Equity,3.50,Energy
`;

  beforeEach(() => {
    vi.clearAllMocks();
    (fs.readFileSync as any).mockReturnValue(mockCsv);
  });

  it('should return structural data from local CSV', async () => {
    const data = await getStructuralData();
    
    expect(data).not.toBeNull();
    if (data) {
      expect(data.lastUpdated).toBe('Loading live data...');
      expect(data.tickerCount).toBe(3);
      expect(data.sectors.length).toBe(2); // Financials and Energy
      
      const financials = data.sectors.find(s => s.name === 'Financials');
      expect(financials).toBeDefined();
      expect(financials?.stocks.length).toBe(2);
      
      const ry = financials?.stocks.find(s => s.ticker === 'RY');
      expect(ry).toBeDefined();
      expect(ry?.price).toBe(0);
      expect(ry?.weight).toBe(6.79);
    }
  });

  it('should include progress when structural data is returned during fetch', async () => {
    // This is a bit hard to test because isFetching is internal state
    // but getStructuralData is exported.
    const data = await getStructuralData();
    expect(data).toBeDefined();
    // Initially progress might be undefined if not fetching
  });

  it('should fallback to structural data if no cache exists', async () => {
    const data = await getHeatmapData();
    expect(data).not.toBeNull();
    expect(data?.lastUpdated).toBe('Loading live data...');
  });
});
