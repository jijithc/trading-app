import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Info, TrendingUp, AlertTriangle, Eye, Plus, List, Trash2 } from 'lucide-react';
import API_BASE_URL from './apiConfig';
import CandleChartModal from './components/CandleChartModal';

export default function Trade() {
  const [symbol, setSymbol] = useState('');
  const [research, setResearch] = useState(null);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);
  const [trading, setTrading] = useState(false);
  const [tradeMsg, setTradeMsg] = useState(null);
  const [selectedTrade, setSelectedTrade] = useState(null);
  const [watchlists, setWatchlists] = useState([]);
  const [watchlistGroupName, setWatchlistGroupName] = useState('Default');
  const [showWatchlistModal, setShowWatchlistModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchWatchlists();
  }, []);

  const fetchWatchlists = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/watchlist`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWatchlists(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchResearch = async (e, customSymbol = null) => {
    if (e) e.preventDefault();
    const targetSymbol = customSymbol || symbol;
    if (!targetSymbol) return;
    setLoading(true);
    setTradeMsg(null);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/trading/research/${targetSymbol}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = res.data;
      
      const currentPrice = data.currentPrice || 0;
      const volatility = data.volatility || 1.5; 
      
      const slPct = volatility * 0.5; 
      const tgtPct = volatility * 1.5; 
      
      const enrichedResearch = {
        ...data,
        signal: data.recommendation ? data.recommendation.toUpperCase() : 'BUY',
        stopLossPrice: currentPrice * (1 - slPct/100),
        targetPrice: currentPrice * (1 + tgtPct/100),
        risk_reward: (tgtPct / slPct).toFixed(1),
        confidence: data.confidence || 75,
        observation: data.recommendation === 'Buy' 
          ? `Stock is showing strong momentum with support at ${ (currentPrice * 0.98).toFixed(2) }. Indicators suggest a potential breakout.`
          : `Stock is facing resistance at ${ (currentPrice * 1.02).toFixed(2) }. Caution advised as trend might shift.`
      };
      setResearch(enrichedResearch);
      if (!customSymbol) setSymbol(targetSymbol);
    } catch (err) {
      console.error(err);
      setTradeMsg({ text: 'Stock not found or API error', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddToWatchlist = () => {
    setShowWatchlistModal(true);
  };

  const confirmAddToWatchlist = async (group) => {
    const finalGroup = group || newGroupName || 'Default';
    try {
      await axios.post(`${API_BASE_URL}/api/watchlist`, {
        symbol: research.symbol,
        watchlistName: finalGroup
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchWatchlists();
      setTradeMsg({ text: `Added ${research.symbol} to ${finalGroup}`, type: 'success' });
      setShowWatchlistModal(false);
      setNewGroupName('');
    } catch (err) {
      console.error(err);
      setTradeMsg({ text: 'Failed to add to watchlist', type: 'error' });
    }
  };

  const handleRemoveFromWatchlist = async (id) => {
    try {
      await axios.delete(`${API_BASE_URL}/api/watchlist/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchWatchlists();
    } catch (err) { console.error(err); }
  };

  const handleTrade = async (type) => {
    setTrading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/trading/trade`, {
        symbol: research.symbol,
        type,
        quantity: parseInt(qty)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTradeMsg({ text: res.data.message, type: 'success' });
    } catch (err) {
      setTradeMsg({ text: 'Trade failed: ' + (err.response?.data || err.message), type: 'error' });
    } finally {
      setTrading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: '1000px', margin: '40px auto' }}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <div className="glass-panel" style={{ marginBottom: '24px' }}>
            <h2 className="title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Search size={28} /> Market Research
            </h2>
            <form onSubmit={fetchResearch} className="trade-form" style={{ display: 'flex', gap: '12px' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Enter Stock Symbol (e.g., RELIANCE)"
                value={symbol}
                onChange={e => setSymbol(e.target.value.toUpperCase())}
                style={{ fontSize: '1.25rem' }}
              />
              <button className="btn btn-accent" style={{ background: 'var(--accent)', color: 'white', padding: '12px 24px' }} disabled={loading}>
                {loading ? 'Analyzing...' : 'Fetch Research'}
              </button>
            </form>
          </div>

          {research && (
            <div className="glass-panel" style={{ animation: 'fadeIn 0.5s ease' }}>
              <div className="research-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div>
                    <h3 
                      style={{ fontSize: '2.2rem', margin: 0, cursor: 'pointer', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '10px' }}
                      onClick={() => setSelectedTrade(research)}
                    >
                      {research.symbol} <Eye size={20} opacity={0.6} />
                    </h3>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '5px' }}>
                      {research.currentPrice && (
                        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Market: <span style={{ color: 'white', fontWeight: 'bold' }}>₹{research.currentPrice.toFixed(2)}</span></p>
                      )}
                      <button 
                        onClick={handleAddToWatchlist}
                        className="btn btn-sm" 
                        style={{ padding: '2px 8px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid var(--accent)', color: 'var(--accent)' }}
                      >
                        <Plus size={12} /> WATCHLIST
                      </button>
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    display: 'inline-block',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: research.signal === 'BUY' ? 'rgba(16, 185, 129, 0.2)' : research.signal === 'SELL' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                    color: research.signal === 'BUY' ? 'var(--success)' : research.signal === 'SELL' ? 'var(--danger)' : '#f59e0b',
                    fontWeight: 'bold',
                    fontSize: '1.25rem'
                  }}>
                    {research.signal} SIGNAL
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3" style={{ marginBottom: '24px', gap: '16px' }}>
                <div className="glass-panel" style={{ padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>Target Price</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--success)' }}>₹{research.targetPrice.toFixed(2)}</div>
                </div>

                <div className="glass-panel" style={{ padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>Stop Loss</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--danger)' }}>₹{research.stopLossPrice.toFixed(2)}</div>
                </div>

                <div className="glass-panel" style={{ padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>Risk / Reward</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: '700' }}>1 : {research.risk_reward}</div>
                </div>
              </div>

              <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '20px', borderRadius: '12px', marginBottom: '32px', display: 'flex', alignItems: 'flex-start', gap: '15px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                <Info color="var(--accent)" style={{ flexShrink: 0, marginTop: '3px' }} />
                <div>
                  <h4 style={{ margin: '0 0 6px', color: 'var(--accent)', fontSize: '1.1rem' }}>Technical Observation</h4>
                  <p style={{ margin: 0, color: 'var(--text-main)', lineHeight: '1.6', fontSize: '0.95rem' }}>{research.reason || research.observation}</p>
                </div>
              </div>

              <div className="trade-btn-container" style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                <div className="form-group" style={{ margin: 0, width: '130px', flexShrink: 0 }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>TRADE QUANTITY</label>
                  <input type="number" min="1" className="form-control" value={qty} onChange={e => setQty(e.target.value)} style={{ padding: '10px' }} />
                </div>
                <div style={{ flex: 1, display: 'flex', gap: '16px' }}>
                  <button
                    className="btn btn-success"
                    style={{ flex: 1, padding: '14px', fontSize: '1.1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}
                    onClick={() => handleTrade('Buy')}
                    disabled={trading}
                  >
                    {trading ? '...' : <TrendingUp size={20} />} BUY
                  </button>
                  <button
                    className="btn btn-danger"
                    style={{ flex: 1, padding: '14px', fontSize: '1.1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}
                    onClick={() => handleTrade('Sell')}
                    disabled={trading}
                  >
                    {trading ? '...' : <AlertTriangle size={20} />} SELL
                  </button>
                </div>
              </div>

              {tradeMsg && (
                <div style={{
                  marginTop: '24px', padding: '16px', borderRadius: '8px', textAlign: 'center', fontWeight: '600',
                  background: tradeMsg.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: tradeMsg.type === 'success' ? 'var(--success)' : 'var(--danger)',
                  border: `1px solid ${tradeMsg.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                }}>
                  {tradeMsg.text}
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <div className="glass-panel" style={{ height: 'fit-content' }}>
            <h3 style={{ margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem', color: 'var(--accent)' }}>
              <List size={20} /> Watch Lists
            </h3>
            
            {watchlists.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px' }}>No stocks in watchlist.</p>
            ) : (
              Object.entries(
                watchlists.reduce((acc, item) => {
                  if (!acc[item.watchlistName]) acc[item.watchlistName] = [];
                  acc[item.watchlistName].push(item);
                  return acc;
                }, {})
              ).map(([group, items]) => (
                <div key={group} style={{ marginBottom: '20px' }}>
                  <div style={{ background: 'rgba(255,255,255,0.05)', padding: '6px 12px', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-secondary)', borderRadius: '4px', marginBottom: '8px' }}>
                    {group}
                  </div>
                  {items.map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 4px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <span 
                        style={{ cursor: 'pointer', fontWeight: '600' }} 
                        onClick={() => fetchResearch(null, item.symbol)}
                      >
                        {item.symbol}
                      </span>
                      <button 
                        onClick={() => handleRemoveFromWatchlist(item.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', opacity: 0.6 }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {selectedTrade && (
        <CandleChartModal trade={selectedTrade} onClose={() => setSelectedTrade(null)} />
      )}

      {showWatchlistModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 3000, display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => setShowWatchlistModal(false)}>
          <div style={{ background: 'var(--panel-bg)', border: '1px solid var(--border)', width: '400px', borderRadius: '16px', padding: '24px', position: 'relative', animation: 'slideUp 0.3s ease' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 20px', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '10px' }}><List size={20} /> Add to Watchlist</h3>
            
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '15px' }}>Choose a group for <strong>{research?.symbol}</strong>:</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', marginBottom: '20px', paddingRight: '5px' }}>
              {[...new Set(watchlists.map(w => w.watchlistName))].map(group => (
                <button 
                  key={group} 
                  onClick={() => confirmAddToWatchlist(group)}
                  style={{ textAlign: 'left', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', color: 'white', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.1)'}
                  onMouseLeave={e => e.target.style.background = 'rgba(255,255,255,0.05)'}
                >
                  {group}
                </button>
              ))}
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>OR CREATE NEW GROUP</div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="New Group Name" 
                  value={newGroupName} 
                  onChange={e => setNewGroupName(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && confirmAddToWatchlist()}
                />
                <button className="btn btn-accent" onClick={() => confirmAddToWatchlist()}>Add</button>
              </div>
            </div>

            <button onClick={() => setShowWatchlistModal(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>×</button>
          </div>
        </div>
      )}
    </div>
  );
}
