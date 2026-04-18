import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Clock, CheckCircle, XCircle, RefreshCw, ShoppingBag, Activity } from 'lucide-react';
import API_BASE_URL from './apiConfig';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [minConfidence, setMinConfidence] = useState(0);
  const [statusFilter, setStatusFilter] = useState('All'); // All, Pending, Executed

  const fetchOrders = async () => {
    setRefreshing(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/trading/orders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrders(res.data);
    } catch (err) {
      console.error('Failed to fetch orders', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefreshConfidence = async () => {
     setReanalyzing(true);
     try {
       const token = localStorage.getItem('token');
       await axios.post(`${API_BASE_URL}/api/trading/refresh-confidence`, {}, {
         headers: { Authorization: `Bearer ${token}` }
       });
       await fetchOrders();
     } catch (err) {
       console.error('Failed to refresh confidence', err);
     } finally {
       setReanalyzing(false);
     }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000); // Auto refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Executed':
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--success)', background: 'rgba(16, 185, 129, 0.1)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>
            <CheckCircle size={14} /> EXECUTED
          </span>
        );
      case 'Rejected':
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>
            <XCircle size={14} /> REJECTED
          </span>
        );
      default:
        return (
          <span className="animate-pulse" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'rgba(255, 255, 255, 0.8)', background: 'rgba(255, 255, 255, 0.1)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>
            <Clock size={14} /> PENDING
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
        <RefreshCw className="animate-spin" size={48} color="var(--accent)" />
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: '1000px', margin: '40px auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 className="title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ShoppingBag size={32} /> Order Book
        </h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleRefreshConfidence}
            disabled={reanalyzing || refreshing}
            className="btn"
            style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', border: '1px solid #3b82f6', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}
          >
            <Activity className={reanalyzing ? 'animate-pulse' : ''} size={16} />
            Re-analyze Pending
          </button>
          <button
            onClick={fetchOrders}
            disabled={refreshing}
            className="btn"
            style={{ background: 'var(--panel-bg)', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <RefreshCw className={refreshing ? 'animate-spin' : ''} size={18} />
            Refresh List
          </button>
        </div>
      </div>

      <div className="glass-panel" style={{ marginBottom: '20px', padding: '16px', display: 'flex', alignItems: 'center', gap: '24px', justifyContent: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>Status:</span>
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            {['All', 'Pending', 'Executed'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  background: statusFilter === s ? 'var(--accent)' : 'transparent',
                  color: statusFilter === s ? 'white' : 'var(--text-secondary)',
                  transition: 'all 0.2s'
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1', minWidth: '250px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>Min Confidence:</span>
          <input 
            type="range" 
            min="0" 
            max="100" 
            value={minConfidence} 
            onChange={(e) => setMinConfidence(parseInt(e.target.value))}
            style={{ flex: '1', accentColor: 'var(--accent)' }}
          />
          <span style={{ 
            fontSize: '0.9rem', 
            fontWeight: 'bold', 
            color: minConfidence > 80 ? 'var(--success)' : (minConfidence > 60 ? '#facc15' : 'white'),
            minWidth: '40px' 
          }}>
            {minConfidence}%+
          </span>
        </div>

        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          Showing {orders.filter(o => (statusFilter === 'All' || o.status === statusFilter) && o.confidence >= minConfidence).length} matches
        </div>
      </div>

      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', background: 'transparent', border: 'none' }}>
        <div className="desktop-only glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table" style={{ margin: 0, tableLayout: 'fixed', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '110px' }}>Time</th>
                <th style={{ width: '180px' }}>Symbol</th>
                <th style={{ width: '150px' }}>Strategy</th>
                <th style={{ width: '110px' }}>Type</th>
                <th style={{ width: '80px', textAlign: 'right' }}>Qty</th>
                <th style={{ width: '110px', textAlign: 'right' }}>Price</th>
                <th style={{ width: '130px', textAlign: 'right' }}>Total</th>
                <th style={{ width: '110px', textAlign: 'center' }}>Conf</th>
                <th style={{ width: '170px', textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
                    No orders found.
                  </td>
                </tr>
              ) : (
                orders
                  .filter(o => (statusFilter === 'All' || o.status === statusFilter) && o.confidence >= minConfidence)
                  .map((order, idx) => (
                  <tr key={order.id || idx}>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {(() => {
                        const d = new Date(order.date);
                        const now = new Date();
                        const isToday = d.getDate() === now.getDate() && 
                                        d.getMonth() === now.getMonth() && 
                                        d.getFullYear() === now.getFullYear();
                        
                        const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                        const parts = timeStr.split(' ');
                        const time = parts[0];
                        const ampm = parts[1] || '';
                        
                        return (
                          <>
                            <div style={{ color: 'white', fontWeight: 'bold' }}>
                              {time} <span style={{ fontSize: '0.65rem', fontWeight: '400', opacity: 0.7, textTransform: 'uppercase' }}>{ampm}</span>
                            </div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                              {isToday ? 'Today' : d.toLocaleDateString()}
                            </div>
                          </>
                        );
                      })()}
                    </td>
                    <td style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{order.symbol}</td>
                    <td style={{ fontSize: '0.85rem' }}>
                      {order.strategyName ? (
                        <span style={{ 
                          background: 'rgba(139, 92, 246, 0.2)', 
                          color: '#c4b5fd', 
                          padding: '4px 8px', 
                          borderRadius: '4px', 
                          border: '1px solid #8b5cf6',
                          display: 'inline-block',
                          maxWidth: '130px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }} title={order.strategyName}>
                          {order.strategyName}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>Manual</span>
                      )}
                    </td>
                    <td>
                      <span style={{
                        color: order.type === 'Buy' ? 'var(--success)' : 'var(--danger)',
                        fontWeight: '800'
                      }}>
                        {order.type?.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{order.quantity}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₹{order.price?.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--accent)' }}>
                      ₹{(order.price * order.quantity).toLocaleString()}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{
                        display: 'inline-block',
                        width: '45px',
                        height: '45px',
                        borderRadius: '50%',
                        border: `3px solid ${order.confidence >= 85 ? 'var(--success)' : (order.confidence >= 75 ? '#facc15' : 'var(--danger)')}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        margin: '0 auto',
                        color: 'white'
                      }}>
                        {order.confidence}%
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', justifyContent: 'center' }}>
                        {getStatusBadge(order.status)}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mobile-only card-view">
          {orders
            .filter(o => (statusFilter === 'All' || o.status === statusFilter) && o.confidence >= minConfidence)
            .map((order, idx) => (
            <div key={order.id || idx} className="mobile-table-card">
              <div className="card-row">
                <div>
                  <span style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>{order.symbol}</span>
                  <span style={{ 
                    marginLeft: '8px',
                    color: order.type === 'Buy' ? 'var(--success)' : 'var(--danger)',
                    fontWeight: '800',
                    fontSize: '0.8rem'
                  }}>
                    {order.type?.toUpperCase()}
                  </span>
                </div>
                <div>
                  {getStatusBadge(order.status)}
                </div>
              </div>
              
              <div className="card-row" style={{ marginTop: '12px' }}>
                <div>
                  <span className="label">Qty @ Price</span>
                  <div className="value">{order.quantity} × ₹{order.price?.toFixed(2)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="label">Total</span>
                  <div className="value" style={{ color: 'var(--accent)' }}>₹{(order.price * order.quantity).toLocaleString()}</div>
                </div>
              </div>

              <div className="card-row" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <span className="label">Time</span>
                  <div className="value" style={{ fontSize: '0.8rem' }}>
                    {new Date(order.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="label">Strategy</span>
                  <div className="value" style={{ fontSize: '0.8rem' }}>
                    {order.strategyName || 'Manual'} ({order.confidence}%)
                  </div>
                </div>
              </div>
            </div>
          ))}
          {orders.length === 0 && <p style={{ color: 'var(--text-secondary)', padding: '40px', textAlign: 'center' }}>No orders found.</p>}
        </div>
      </div>
    </div>
  );
}
