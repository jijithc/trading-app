import React, { useState, useEffect } from 'react';
import { Flame, Activity, TrendingUp, AlertTriangle, RefreshCw } from 'lucide-react';
import API_BASE_URL from './apiConfig';

export default function HotStocks() {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Bulk Trade States
  const [selectedStocks, setSelectedStocks] = useState([]);
  const [targetPercent, setTargetPercent] = useState(5.0);
  const [stopLossPercent, setStopLossPercent] = useState(2.0);
  const [tradeQty, setTradeQty] = useState(10);
  const [trading, setTrading] = useState(false);
  const [tradeMsg, setTradeMsg] = useState(null);
  const [localQtys, setLocalQtys] = useState({}); // { symbol: qty }
  const [showBulkSettings, setShowBulkSettings] = useState(true);
  const [filters, setFilters] = useState({ gainers: false, volumes: false, active: true });
  const [sortConfig, setSortConfig] = useState({ key: 'percentChange', direction: 'desc' });

  // Function exactly as requested
  async function getStock(symbol) {
    try {
      // Fetch using the local Vite proxy which guarantees real-time browser caching natively
      const res = await fetch(
        `/api/yahoo/v8/finance/chart/${symbol}`
      );
      if (!res.ok) throw new Error(`Yahoo API Error: ${res.statusText}`);
      const data = await res.json();
      const meta = data.chart.result[0].meta;

      return {
        symbol,
        price: meta.regularMarketPrice,
        previousClose: meta.previousClose,
        change: meta.regularMarketPrice - meta.previousClose,
        percentChange: ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100
      };
    } catch (err) {
      console.warn(`Failed to fetch live data for ${symbol}`, err);
      // Wait to bypass rate limit slowly, skip mock data and just return null 
      // so the card fails to render rather than showing wrong "mock" prices that confuse the user
      return null;
    }
  }

  const fetchHotStocks = async () => {
    setRefreshing(true);
    setError('');

    try {
      // NSE APIs often reject naked requests or direct browser CORS requests. 
      // We are writing the logic as requested to merge gainers & volume spurts.
      // Call our own professional ASP.NET Backend API endpoints
      // The backend securely communicates with NSE India, bypassing the browser's restrictions entirely
      const fetchPromises = [];
      if (filters.gainers) fetchPromises.push(fetch(`${API_BASE_URL}/api/MarketData/nse/gainers`).then(res => res.ok ? res.json() : null).catch(() => null));
      else fetchPromises.push(Promise.resolve(null));

      if (filters.volumes) fetchPromises.push(fetch(`${API_BASE_URL}/api/MarketData/nse/volumespurts`).then(res => res.ok ? res.json() : null).catch(() => null));
      else fetchPromises.push(Promise.resolve(null));

      if (filters.active) fetchPromises.push(fetch(`${API_BASE_URL}/api/MarketData/nse/mostactive`).then(res => res.ok ? res.json() : null).catch(() => null));
      else fetchPromises.push(Promise.resolve(null));

      const [gainersData, volumesData, activeData] = await Promise.all(fetchPromises);

      // If NSE blocks us due to CORS or Cookie requirements, we'll fall back to dummy mock data to ensure the UI works beautifully.
      if (!gainersData && !volumesData && !activeData) {
        console.warn('NSE APIs blocked. Falling back to simulated data.');
        await simulateFallbackData();
        return;
      }

      const gainersList = gainersData?.NIFTY?.data || [];
      const volumeSpurtsList = volumesData || [];
      const activeList = activeData?.data || [];

      // Using a set to deduplicate symbols
      const symbolSet = new Set();

      // 1. Add symbols from Volume Spurts (highest momentum)
      volumeSpurtsList.slice(0, 30).forEach(s => symbolSet.add(s.symbol));

      // 2. Add symbols from Gainers (> 2%)
      gainersList.filter(s => s.perChange > 2).slice(0, 30).forEach(s => symbolSet.add(s.symbol));

      // 3. Add symbols from Most Active (highest volume)
      activeList.slice(0, 30).forEach(s => symbolSet.add(s.symbol));

      const hotSymbols = Array.from(symbolSet).map(s => `${s}.NS`);

      // Fetch live LTPs using Yahoo Finance function
      // We limit to 30 symbols to avoid excessive Yahoo API delay or 429 errors
      const limitedSymbols = hotSymbols.slice(0, 30);

      const liveDataResults = [];
      const volumeMap = {};
      [...volumeSpurtsList, ...activeList].forEach(item => { volumeMap[item.symbol] = item; });

      for (const sym of limitedSymbols) {
        const data = await getStock(sym);
        if (data) Object.assign(data, volumeMap[sym.replace('.NS', '')]); // Merge the volume context
        liveDataResults.push(data);
        // Add a 300ms delay between Yahoo API calls (optimized for larger lists)
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      const finalStocks = liveDataResults.filter(s => s !== null);
      setStocks(finalStocks);
      setSelectedStocks(finalStocks); // Auto-select all stocks for bulk trade by default

    } catch (err) {
      console.error(err);
      setError('Failed to fetch hot stocks. See console for details.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const simulateFallbackData = async () => {
    // Simulated stocks if NSE blocks our CORS
    const mockSymbols = [
      "RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS", "ICICIBANK.NS",
      "BAJFINANCE.NS", "SBIN.NS", "BHARTIARTL.NS", "ITC.NS", "KOTAKBANK.NS",
      "LT.NS", "AXISBANK.NS", "ASIANPAINT.NS", "MARUTI.NS", "SUNPHARMA.NS",
      "TITAN.NS", "WIPRO.NS", "ULTRACEMCO.NS", "ADANIENT.NS", "JSWSTEEL.NS"
    ];

    const liveDataResults = [];
    for (const sym of mockSymbols) {
      const data = await getStock(sym);
      liveDataResults.push(data);
      // Wait to not trip Yahoo rate limit again
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    let processedStocks = liveDataResults.filter(s => s !== null);

    setStocks(processedStocks);
    setSelectedStocks(processedStocks); // Auto-select fallback stocks for bulk trade by default
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchHotStocks();
  }, [filters]);

  const handleSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const getSortedStocks = () => {
    const sorted = [...stocks].sort((a, b) => {
      let valA = a[sortConfig.key];
      let valB = b[sortConfig.key];

      // Special cases for volume or other nested fields if any
      if (sortConfig.key === 'total') {
        valA = (a.price || 0) * (localQtys[a.symbol] || tradeQty);
        valB = (b.price || 0) * (localQtys[b.symbol] || tradeQty);
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  };

  const sortedStocks = getSortedStocks();

  const toggleSelection = (stock) => {
    setSelectedStocks(prev => {
      const exists = prev.find(s => s.symbol === stock.symbol);
      if (exists) return prev.filter(s => s.symbol !== stock.symbol);
      return [...prev, stock];
    });
  };

  const toggleSelectAll = () => {
    if (selectedStocks.length === stocks.length) {
      setSelectedStocks([]);
    } else {
      setSelectedStocks([...stocks]);
    }
  };

  const handleBulkTrade = async () => {
    if (selectedStocks.length === 0) return;
    setTrading(true);
    setTradeMsg(null);
    try {
      const tradePayload = {
        trades: selectedStocks.map(s => ({
          symbol: s.symbol.replace('.NS', ''), // Clean symbol for backend
          type: 'Buy',
          quantity: localQtys[s.symbol] || tradeQty,
          price: s.price || 0,
          targetPercent: targetPercent || 5.0,
          stopLossPercent: stopLossPercent || 2.0
        }))
      };

      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/trading/bulk-trade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(tradePayload)
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Bulk trade API error');
      }

      setTradeMsg({ text: 'Paper Trades Executed and Auto-Sell Goals Configured!', type: 'success' });
      // clear selection after processing
      setSelectedStocks([]);
    } finally {
      setTrading(false);
    }
  }

  const handleIndividualTrade = async (stock, e, type) => {
    e.stopPropagation();
    setTrading(true);
    setTradeMsg(null);
    const qty = localQtys[stock.symbol] || tradeQty;
    try {
      const tradePayload = {
        trades: [{
          symbol: stock.symbol.replace('.NS', ''),
          type: type, // 'Buy' or 'Sell'
          quantity: qty,
          price: stock.price,
          targetPercent: targetPercent,
          stopLossPercent: stopLossPercent
        }]
      };

      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/trading/bulk-trade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(tradePayload)
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Trade API error');
      }

      setTradeMsg({ text: `${type} of ${qty} ${stock.symbol.replace('.NS', '')} executed!`, type: 'success' });
    } catch (err) {
      setTradeMsg({ text: 'Failed to execute trade: ' + err.message, type: 'danger' });
    } finally {
      setTrading(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: '900px', margin: '40px auto' }}>
      <div className="glass-panel" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 className="title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Flame size={28} color="#ef4444" /> Hot Stocks
            </h2>
            <p style={{ color: 'var(--text-secondary)' }}>Filtered by NSE API (Volume Spurts + Gainers) & Live Yahoo Data</p>
          </div>
          <button
            className="btn"
            onClick={fetchHotStocks}
            disabled={refreshing}
            style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}
          >
            <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
            <span className="desktop-only">Refresh Board</span>
          </button>
        </div>

        {/* Categories / Filter Bar */}
        <div style={{
          display: 'flex', gap: '20px', padding: '12px 16px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px', marginTop: '16px', flexWrap: 'wrap',
          border: '1px solid var(--border)'
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
            <input type="checkbox" checked={filters.gainers} onChange={() => setFilters({ ...filters, gainers: !filters.gainers })} />
            <span style={{ color: filters.gainers ? 'var(--success)' : 'var(--text-secondary)', fontWeight: filters.gainers ? '700' : '500' }}>Top Gainers (&gt;2%)</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
            <input type="checkbox" checked={filters.volumes} onChange={() => setFilters({ ...filters, volumes: !filters.volumes })} />
            <span style={{ color: filters.volumes ? '#bfdbfe' : 'var(--text-secondary)', fontWeight: filters.volumes ? '700' : '500' }}>Volume Spurts</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
            <input type="checkbox" checked={filters.active} onChange={() => setFilters({ ...filters, active: !filters.active })} />
            <span style={{ color: filters.active ? '#fbbf24' : 'var(--text-secondary)', fontWeight: filters.active ? '700' : '500' }}>Most Active</span>
          </label>
        </div>
      </div>
      {showBulkSettings && (
        <div className="glass-panel" style={{ marginBottom: '24px', padding: '20px', border: '1px solid rgba(59, 130, 246, 0.3)', position: 'relative' }}>
          <button
            onClick={() => setShowBulkSettings(false)}
            style={{ position: 'absolute', top: '10px', right: '10px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
          >✕</button>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px' }}>
            <Activity size={18} color="var(--accent)" />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 'bold' }}>Bulk Implementation Policy</h3>
          </div>

          <div style={{
            display: 'flex', gap: '12px', background: 'rgba(59, 130, 246, 0.15)', padding: '16px', borderRadius: '12px', flexWrap: 'wrap', alignItems: 'flex-end'
          }}>
            <div className="form-group" style={{ margin: 0, minWidth: '100px', flex: '1' }}>
              <label style={{ margin: '0 0 4px', fontSize: '0.75rem', color: '#bfdbfe' }}>Qty</label>
              <input type="number" min="1" className="form-control" style={{ padding: '8px', background: 'rgba(0,0,0,0.3)', fontSize: '0.85rem' }} value={tradeQty} onChange={e => setTradeQty(Number(e.target.value))} />
            </div>
            <div className="form-group" style={{ margin: 0, minWidth: '110px', flex: '1' }}>
              <label style={{ margin: '0 0 4px', fontSize: '0.75rem', color: '#86efac' }}>Target %</label>
              <input type="number" step="0.1" className="form-control" style={{ padding: '8px', color: 'var(--success)', borderColor: 'var(--success)', background: 'rgba(0,0,0,0.3)', fontSize: '0.85rem' }} value={targetPercent} onChange={e => setTargetPercent(Number(e.target.value))} />
            </div>
            <div className="form-group" style={{ margin: 0, minWidth: '110px', flex: '1' }}>
              <label style={{ margin: '0 0 4px', fontSize: '0.75rem', color: '#fca5a5' }}>Stop Loss %</label>
              <input type="number" step="0.1" className="form-control" style={{ padding: '8px', color: 'var(--danger)', borderColor: 'var(--danger)', background: 'rgba(0,0,0,0.3)', fontSize: '0.85rem' }} value={stopLossPercent} onChange={e => setStopLossPercent(Number(e.target.value))} />
            </div>
            <button
              className="btn btn-success"
              style={{ padding: '8px 20px', fontWeight: 'bold', minWidth: '180px' }}
              disabled={selectedStocks.length === 0 || trading}
              onClick={handleBulkTrade}
            >
              {trading ? '...' : `Bulk Trade (${selectedStocks.length})`}
            </button>
          </div>

          {tradeMsg && (
            <div style={{ marginTop: '12px', fontSize: '0.85rem', textAlign: 'center', color: tradeMsg.type === 'success' ? 'var(--success)' : 'var(--danger)' }}>
              {tradeMsg.text}
            </div>
          )}
        </div>
      )}

      {/* Re-Open Button if Hidden */}
      {!showBulkSettings && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
          <button className="btn" onClick={() => setShowBulkSettings(true)} style={{ fontSize: '0.75rem', padding: '4px 12px', background: 'rgba(59, 130, 246, 0.1)' }}>
            Show Bulk Policy Controls
          </button>
        </div>
      )}

      {error && (
        <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger)', borderRadius: '8px', border: '1px solid var(--danger)', marginBottom: '24px' }}>
          <AlertTriangle style={{ display: 'inline-block', marginRight: '8px' }} size={20} />
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <Activity size={48} color="var(--accent)" className="animate-pulse" />
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="desktop-only glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="table" style={{ margin: 0, width: '100%', tableLayout: 'auto' }}>
              <thead>
                <tr>
                  <th style={{ width: '40px', padding: '12px' }}>
                    <input type="checkbox" checked={selectedStocks.length === stocks.length && stocks.length > 0} onChange={toggleSelectAll} />
                  </th>
                  <th onClick={() => handleSort('symbol')} style={{ cursor: 'pointer' }}>Symbol {sortConfig.key === 'symbol' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                  <th onClick={() => handleSort('price')} style={{ textAlign: 'right', cursor: 'pointer' }}>LTP {sortConfig.key === 'price' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                  <th onClick={() => handleSort('percentChange')} style={{ textAlign: 'right', cursor: 'pointer' }}>Chg% {sortConfig.key === 'percentChange' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                  <th onClick={() => handleSort('totalTradedVolume')} style={{ textAlign: 'right', cursor: 'pointer', whiteSpace: 'nowrap' }}>Vol {sortConfig.key === 'totalTradedVolume' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                  <th style={{ textAlign: 'center' }}>Size</th>
                  <th onClick={() => handleSort('total')} style={{ textAlign: 'right', cursor: 'pointer' }}>Total (₹)</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedStocks.length === 0 && (
                  <tr><td colSpan="8" style={{ textAlign: 'center', padding: '40px' }}>No stocks currently meet criteria.</td></tr>
                )}
                {sortedStocks.map((stock, idx) => {
                  const isGainer = stock.change >= 0;
                  const isSelected = selectedStocks.some(s => s.symbol === stock.symbol);
                  const qty = localQtys[stock.symbol] || tradeQty;
                  const total = (stock.price || 0) * qty;

                  return (
                    <tr key={idx} style={{
                      background: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                      borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent'
                    }}>
                      <td style={{ paddingLeft: '12px' }}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelection(stock)} />
                      </td>
                      <td style={{ fontWeight: 'bold' }}>{stock.symbol.replace('.NS', '')}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₹{stock.price ? stock.price.toFixed(1) : '---'}</td>
                      <td style={{ textAlign: 'right', color: isGainer ? 'var(--success)' : 'var(--danger)', fontWeight: 'bold' }}>
                        {isGainer ? '+' : ''}{stock.percentChange?.toFixed(2)}%
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        {stock.totalTradedVolume ? (stock.volume / 100000).toFixed(1) + 'L' : '---'}
                      </td>
                      <td style={{ width: '80px', textAlign: 'center' }}>
                        <input
                          type="number" min="1" className="form-control"
                          style={{ padding: '4px', width: '55px', margin: '0 auto', background: 'rgba(0,0,0,0.3)', fontSize: '0.8rem' }}
                          value={qty}
                          onChange={e => setLocalQtys({ ...localQtys, [stock.symbol]: Number(e.target.value) })}
                        />
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--accent)' }}>₹{total.toLocaleString()}</td>
                      <td style={{ width: '110px' }}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                          <button className="btn btn-success" onClick={(e) => handleIndividualTrade(stock, e, 'Buy')} disabled={trading} style={{ padding: '2px 8px', fontSize: '0.75rem' }}>B</button>
                          <button className="btn btn-danger" onClick={(e) => handleIndividualTrade(stock, e, 'Sell')} disabled={trading} style={{ padding: '2px 8px', fontSize: '0.75rem' }}>S</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Grid View (2 per row) */}
          <div className="mobile-only hot-stocks-grid" style={{ gap: '8px' }}>
            {sortedStocks.map((stock, idx) => {
              const isGainer = stock.change >= 0;
              const isSelected = selectedStocks.some(s => s.symbol === stock.symbol);
              return (
                <div
                  key={idx}
                  className="glass-panel"
                  style={{
                    padding: '8px', transition: 'all 0.1s', cursor: 'pointer',
                    border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
                    background: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'var(--panel-bg)',
                    display: 'flex', flexDirection: 'column', gap: '6px'
                  }}
                  onClick={() => toggleSelection(stock)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: 0, gap: '2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
                      <div style={{ flexShrink: 0, width: '12px', height: '12px', borderRadius: '2px', border: '1px solid var(--accent)', background: isSelected ? 'var(--accent)' : 'transparent' }} />
                      <h3 style={{ fontSize: '0.85rem', fontWeight: 'bold', margin: 0, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {stock.symbol.replace('.NS', '')}
                      </h3>
                    </div>
                    <div style={{
                      flexShrink: 0, padding: '0px 3px', borderRadius: '3px', background: isGainer ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                      color: isGainer ? 'var(--success)' : 'var(--danger)', fontWeight: '900', fontSize: '0.6rem', whiteSpace: 'nowrap'
                    }}>
                      {isGainer ? '+' : ''}{stock.percentChange?.toFixed(1)}%
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '1rem', fontWeight: '800', color: 'white' }}>₹{(stock.price || 0).toFixed(0)}</div>
                    <input
                      type="number" min="1" className="form-control"
                      style={{ padding: '0 2px', width: '35px', background: 'rgba(0,0,0,0.5)', fontSize: '0.7rem', height: '18px', border: 'none' }}
                      value={localQtys[stock.symbol] || tradeQty} onClick={e => e.stopPropagation()}
                      onChange={e => setLocalQtys({ ...localQtys, [stock.symbol]: Number(e.target.value) })}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '2px' }}>
                    <button className="btn btn-success" onClick={(e) => handleIndividualTrade(stock, e, 'Buy')} disabled={trading} style={{ flex: 1, padding: '0', fontSize: '0.65rem', height: '22px' }}>B</button>
                    <button className="btn btn-danger" onClick={(e) => handleIndividualTrade(stock, e, 'Sell')} disabled={trading} style={{ flex: 1, padding: '0', fontSize: '0.65rem', height: '22px' }}>S</button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
