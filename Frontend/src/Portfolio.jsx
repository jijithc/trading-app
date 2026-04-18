import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Activity, Briefcase, X, TrendingUp, TrendingDown, BarChart2 } from 'lucide-react';
import API_BASE_URL from './apiConfig';
import CandleChartModal from './components/CandleChartModal';

export default function Portfolio() {
  const [portfolio, setPortfolio] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState('');
  const [selectedStock, setSelectedStock] = useState(null);
  
  // Filtering & Pagination States
  const [filter, setFilter] = useState('Today'); // 'Today' or 'Past'
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) return;
    const fetchPortfolio = async () => {
      try {
        const [portRes, transRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/trading/portfolio`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API_BASE_URL}/api/trading/transactions`, { headers: { Authorization: `Bearer ${token}` } })
        ]);
        setPortfolio(portRes.data);
        setTransactions(transRes.data);
      } catch (err) {
        console.error('Failed to fetch data', err);
      }
    };
    
    fetchPortfolio();
    const interval = setInterval(fetchPortfolio, 5000); // 5s refresh
    return () => clearInterval(interval);
  }, [token]);

  if (error) return <div className="container" style={{ color: 'var(--danger)' }}>{error}</div>;
  if (!portfolio) return <div className="container" style={{ display: 'flex', justifyContent: 'center', marginTop: '100px' }}><Activity className="animate-pulse" size={48} color="var(--accent)" /></div>;

  // Filter Logic
  const filteredTransactions = transactions.filter(t => {
    const tDate = new Date(t.date).toDateString();
    const today = new Date().toDateString();
    return filter === 'Today' ? tDate === today : tDate !== today;
  });

  // Pagination Logic
  const totalPages = Math.ceil(filteredTransactions.length / pageSize);
  const paginatedTransactions = filteredTransactions.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="container">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px', marginBottom: '40px' }}>
        {/* Main Performance Card */}
        <div className="glass-panel" style={{ 
          padding: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' 
        }}>
          <div style={{ flex: 1, paddingRight: '30px' }}>
            <h2 className="title" style={{ fontSize: '0.8rem', marginBottom: '8px', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '1px' }}>Current Net Asset Value</h2>
            <div style={{ fontSize: '3.8rem', fontWeight: '900', color: 'var(--success)', letterSpacing: '-2px', lineHeight: '1' }}>
              ₹{portfolio.totalCurrentValue?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div style={{ 
            flex: 1, paddingLeft: '40px', borderLeft: '1px solid rgba(255,255,255,0.1)', 
            display: 'flex', flexDirection: 'column', gap: '20px'
          }}>
            <div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '4px', textTransform: 'uppercase' }}>Invested</p>
              <span style={{ fontSize: '1.4rem', fontWeight: '700', color: 'white' }}>
                ₹{portfolio.totalInvested?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '4px', textTransform: 'uppercase' }}>Total P&L</p>
              <div style={{ 
                fontSize: '1.4rem', fontWeight: '700', 
                color: portfolio.totalPnL >= 0 ? 'var(--success)' : 'var(--danger)' 
              }}>
                {portfolio.totalPnL >= 0 ? '+' : ''}₹{portfolio.totalPnL?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <span style={{ fontSize: '0.9rem', marginLeft: '8px', opacity: 0.8 }}>
                  ({portfolio.totalInvested > 0 ? ((portfolio.totalPnL / portfolio.totalInvested) * 100).toFixed(2) : '0.00'}%)
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Balance Card */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '30px' }}>
           <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Available Balance</p>
           <div style={{ fontSize: '2.25rem', fontWeight: '800', color: 'var(--accent)', letterSpacing: '-1px' }}>
             ₹{portfolio.balance?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
           </div>
           <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '12px', fontStyle: 'italic' }}>
             Ready to deploy
           </p>
        </div>
      </div>

      <div className="grid grid-cols-2">
        <div className="glass-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
            <Briefcase color="var(--accent)" />
            <h3 className="subtitle" style={{ margin: 0 }}>Current Broker Positions</h3>
          </div>
          <div className="table-responsive">
            <table className="table" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: '150px' }}>Symbol</th>
                  <th style={{ textAlign: 'right' }}>Invested</th>
                  <th style={{ textAlign: 'right' }}>Current Value</th>
                  <th style={{ textAlign: 'right', width: '150px' }}>P&L Change</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.positions.map((pos, idx) => (
                  <tr key={idx}>
                    <td 
                      style={{ cursor: 'pointer', color: 'var(--accent)', fontWeight: 'bold' }} 
                      onClick={() => setSelectedStock({ 
                        symbol: pos.symbol, 
                        currentPrice: pos.currentPrice,
                        quantity: pos.quantity,
                        entryPrice: pos.avgPrice
                      })}
                    >
                      {pos.symbol}
                    </td>
                    <td style={{ textAlign: 'right' }}>₹{pos.investedValue?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₹{pos.currentValue?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ color: pos.valueChange >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 'bold' }}>
                        {pos.valueChange >= 0 ? '+' : ''}₹{pos.valueChange?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: pos.valueChange >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {pos.valueChange >= 0 ? '+' : ''}{pos.percChange?.toFixed(2)}%
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {portfolio.positions.length === 0 && <p style={{ color: 'var(--text-secondary)', padding: '20px', textAlign: 'center' }}>No open positions.</p>}
        </div>

        <div className="glass-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 className="subtitle" style={{ margin: 0 }}>Recent Transactions</h3>
            <div className="btn-group" style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '4px' }}>
              <button 
                onClick={() => { setFilter('Today'); setCurrentPage(1); }}
                style={{ 
                  padding: '6px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600',
                  background: filter === 'Today' ? 'var(--accent)' : 'transparent',
                  color: filter === 'Today' ? 'white' : 'var(--text-secondary)'
                }}
              >Today</button>
              <button 
                onClick={() => { setFilter('Past'); setCurrentPage(1); }}
                style={{ 
                  padding: '6px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600',
                  background: filter === 'Past' ? 'var(--accent)' : 'transparent',
                  color: filter === 'Past' ? 'white' : 'var(--text-secondary)'
                }}
              >Past</button>
            </div>
          </div>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Symbol</th>
                  <th className="desktop-only">Type</th>
                  <th className="col-qty">Qty</th>
                  <th>Price</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTransactions.map((t, idx) => (
                  <tr key={idx}>
                    <td>
                      <span className="desktop-only">{new Date(t.date).toLocaleTimeString()}</span>
                      <span className="mobile-only">{new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </td>
                    <td style={{ fontWeight: '600' }}>
                      {t.symbol}
                      <span className="mobile-only" style={{
                        marginLeft: '8px', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: '600',
                        background: t.type === 'Buy' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        color: t.type === 'Buy' ? 'var(--success)' : 'var(--danger)',
                        verticalAlign: 'middle'
                      }}>
                        {t.type}
                      </span>
                    </td>
                    <td className="desktop-only">
                      <span style={{
                        padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600',
                        background: t.type === 'Buy' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        color: t.type === 'Buy' ? 'var(--success)' : 'var(--danger)'
                      }}>
                        {t.type}
                      </span>
                    </td>
                    <td className="col-qty">{t.quantity}</td>
                    <td><span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginRight: '2px' }}>INR</span> {t.price.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '20px', padding: '10px' }}>
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
                className="btn"
                style={{ padding: '4px 12px', fontSize: '0.875rem', opacity: currentPage === 1 ? 0.5 : 1 }}
              >Prev</button>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                Page <span style={{ color: 'var(--text-main)', fontWeight: '600' }}>{currentPage}</span> of {totalPages}
              </span>
              <button 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => prev + 1)}
                className="btn"
                style={{ padding: '4px 12px', fontSize: '0.875rem', opacity: currentPage === totalPages ? 0.5 : 1 }}
              >Next</button>
            </div>
          )}

          {filteredTransactions.length === 0 && <p style={{ color: 'var(--text-secondary)', padding: '20px', textAlign: 'center' }}>No {filter.toLowerCase()} transactions found.</p>}
        </div>
      </div>
      {selectedStock && <CandleChartModal trade={selectedStock} onClose={() => setSelectedStock(null)} />}
    </div>
  );
}
