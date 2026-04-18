import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Activity, PieChart, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import API_BASE_URL from './apiConfig';

export default function ProfitLoss() {
  const [data, setData] = useState([]);
  const [totalPnL, setTotalPnL] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filter, setFilter] = useState('Today'); // 'Today' or 'Past'
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) return;
    const fetchTransactions = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/trading/transactions`, { 
          headers: { Authorization: `Bearer ${token}` } 
        });
        
        const txs = res.data.sort((a, b) => new Date(a.date) - new Date(b.date));
        const todayStr = new Date().toDateString();
        
        const stats = {};
        let netRealized = 0;

        txs.forEach(t => {
          if (!stats[t.symbol]) {
            stats[t.symbol] = { 
              symbol: t.symbol, 
              inventoryQty: 0, 
              inventoryCost: 0, 
              realizedPnL: 0,
              totalSold: 0
            };
          }

          const s = stats[t.symbol];
          const isToday = new Date(t.date).toDateString() === todayStr;

          if (t.type === 'Buy') {
            s.inventoryQty += t.quantity;
            s.inventoryCost += (t.quantity * t.price);
          } else if (t.type === 'Sell') {
            const avgCost = s.inventoryQty > 0 ? (s.inventoryCost / s.inventoryQty) : 0;
            const cogs = t.quantity * avgCost;
            const revenue = t.quantity * t.price;
            const tradePnL = revenue - cogs;
            
            if ((filter === 'Today' && isToday) || (filter === 'Past' && !isToday)) {
              s.realizedPnL += tradePnL;
              s.totalSold += t.quantity;
              netRealized += tradePnL;
            }
            
            s.inventoryQty -= t.quantity;
            s.inventoryCost -= cogs;
          }
        });

        const pnlArray = Object.values(stats)
          .filter(s => s.totalSold > 0)
          .sort((a, b) => b.realizedPnL - a.realizedPnL);

        setData(pnlArray);
        setTotalPnL(netRealized);
      } catch (err) {
        setError('Failed to fetch transaction data for P&L analysis');
      } finally {
        setLoading(false);
      }
    };
    fetchTransactions();
  }, [token, filter]);

  const totalPages = Math.ceil(data.length / pageSize);
  const paginatedData = data.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (error) return <div className="container" style={{ color: 'var(--danger)' }}>{error}</div>;
  if (loading) return <div className="container" style={{ display: 'flex', justifyContent: 'center', marginTop: '100px' }}><Activity className="animate-pulse" size={48} color="var(--accent)" /></div>;

  const isNetProfit = totalPnL >= 0;

  return (
    <div className="container" style={{ maxWidth: '1000px', margin: '40px auto' }}>
      <div className="glass-panel" style={{ marginBottom: '40px', textAlign: 'center' }}>
        <h2 className="title" style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Net Realized Profit & Loss</h2>
        <div style={{ 
          fontSize: '3.5rem', 
          fontWeight: '700', 
          color: isNetProfit ? 'var(--success)' : 'var(--danger)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px'
        }}>
          {isNetProfit ? <ArrowUpRight size={48} /> : <ArrowDownRight size={48} />}
          {isNetProfit ? '+' : ''}
          <span style={{ fontSize: '1.5rem', color: 'var(--text-secondary)', marginRight: '4px' }}>INR</span>
          {totalPnL.toFixed(2)}
        </div>
        <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>Based on historical closed position execution data.</p>
      </div>

      <div className="glass-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PieChart color="var(--accent)" />
            <h3 className="subtitle" style={{ margin: 0 }}>Realized P&L By Asset</h3>
          </div>
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
        
        {paginatedData.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', padding: '20px', textAlign: 'center' }}>
            No completely finished round-trip trades ({filter.toLowerCase()}) exist yet.
          </p>
        ) : (
          <>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th className="col-qty">Total Shares Sold</th>
                    <th style={{ textAlign: 'right' }}>Realized Return</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((item, idx) => {
                    const isProfit = item.realizedPnL >= 0;
                    return (
                      <tr key={idx}>
                        <td style={{ fontWeight: '600', fontSize: '1.1rem' }}>{item.symbol}</td>
                        <td className="col-qty">{item.totalSold}</td>
                        <td style={{ 
                          textAlign: 'right', 
                          fontWeight: '700', 
                          color: isProfit ? 'var(--success)' : 'var(--danger)',
                          fontSize: '1.1rem'
                        }}>
                          {isProfit ? '+' : ''}
                          <span style={{ fontSize: '0.75rem', color: isProfit ? 'var(--success)' : 'var(--danger)', marginRight: '4px', fontWeight: 'normal' }}>INR</span>
                          {item.realizedPnL.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
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
          </>
        )}
      </div>
    </div>
  );
}
