import React, { useState, useEffect } from 'react';
import { X, Activity, RefreshCw } from 'lucide-react';

const CandleChartModal = ({ trade, onClose }) => {
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [range, setRange] = useState('1d');
  const [interval, setIntervalVal] = useState('5m');

  const tfOptions = [
    { label: '1D', range: '1d', interval: '5m' },
    { label: '5D', range: '5d', interval: '15m' },
    { label: '1M', range: '1mo', interval: '1h' },
    { label: '3M', range: '3mo', interval: '1d' },
    { label: '1Y', range: '1y', interval: '1d' },
    { label: 'MAX', range: 'max', interval: '1wk' },
  ];

  const fetchChart = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    setLoading(true);
    try {
      const sym = trade.symbol.endsWith('.NS') ? trade.symbol : `${trade.symbol}.NS`;
      const res = await fetch(`/api/yahoo/v8/finance/chart/${sym}?interval=${interval}&range=${range}`);
      const json = await res.json();
      setChartData(json.chart.result[0]);
    } catch (e) { 
      console.error('Chart fetch error:', e); 
    } finally { 
      setLoading(false); 
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchChart();
  }, [trade.symbol, range, interval]);

  const handleTFChange = (opt) => {
    setRange(opt.range);
    setIntervalVal(opt.interval);
  };

  const renderCandles = () => {
    if (!chartData || !chartData.timestamp) return <div style={{ textAlign: 'center', opacity: 0.5, padding: '40px' }}>No Intraday Data Available</div>;
    
    const quotes = chartData.indicators.quote[0];
    const { open, high, low, close } = quotes;
    const validIndices = chartData.timestamp.map((_, i) => i).filter(i => close[i] !== null);
    
    if (validIndices.length < 2) return <div style={{ textAlign: 'center', opacity: 0.5, padding: '40px' }}>Insufficient data for candles</div>;

    const p_low = validIndices.map(i => low[i]);
    const p_high = validIndices.map(i => high[i]);
    
    const candleMin = Math.min(...p_low);
    const candleMax = Math.max(...p_high);
    const volume = quotes.volume || [];
    const maxVol = Math.max(...volume.filter(v => v !== null), 1);
    
    const sl = Number(trade.stopLossPrice) || 0;
    const tgt = Number(trade.targetPrice) || 0;
    const entry = Number(trade.entryPrice || trade.currentPrice) || 0;

    // Auto-scale including indicators with a 10% buffer
    const rawMin = Math.min(candleMin, sl > 0 ? sl : Infinity, entry > 0 ? entry : Infinity);
    const rawMax = Math.max(candleMax, tgt > 0 ? tgt : -Infinity, entry > 0 ? entry : -Infinity);
    const rawRange = rawMax - rawMin;
    
    // Add 10% vertical padding
    const min = rawMin - (rawRange * 0.1);
    const max = rawMax + (rawRange * 0.1);
    const rangeVal = (max - min) || 1;
    
    const width = 800;
    const height = 300;
    const getY = (price) => height - ((price - min) / rangeVal) * height;

    // Calculate grid intervals (e.g., 5-6 lines)
    const gridPoints = [];
    const step = rangeVal / 6;
    for (let i = 0; i <= 6; i++) {
      gridPoints.push(min + (step * i));
    }

    return (
      <div style={{ position: 'relative', marginTop: '20px' }}>
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
          {/* Grid Lines */}
          {gridPoints.map((p, i) => (
            <g key={i}>
              <line x1="0" y1={getY(p)} x2={width} y2={getY(p)} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
              <text x={width + 10} y={getY(p) + 4} fill="rgba(255,255,255,0.3)" fontSize="10">{p.toFixed(1)}</text>
            </g>
          ))}

          {/* Volume Bars (Base 20% height) */}
          {validIndices.map((idx, i) => {
            const x = (i / (validIndices.length - 1)) * (width - 20) + 10;
            const barWidth = Math.max(1, (width / validIndices.length) * 0.5);
            const v = volume[idx] || 0;
            const barHeight = (v / maxVol) * (height * 0.2);
            return (
              <rect key={`vol-${idx}`} x={x - barWidth/2} y={height - barHeight} width={barWidth} height={barHeight} fill="rgba(255,255,255,0.15)" />
            );
          })}

          {/* Guide Lines */}
          {tgt > 0 && (
            <line x1="0" y1={getY(tgt)} x2={width} y2={getY(tgt)} stroke="var(--success)" strokeWidth="1" strokeDasharray="4,4" opacity="0.6" />
          )}
          {sl > 0 && (
            <line x1="0" y1={getY(sl)} x2={width} y2={getY(sl)} stroke="var(--danger)" strokeWidth="1" strokeDasharray="4,4" opacity="0.6" />
          )}
          {entry > 0 && (
            <line x1="0" y1={getY(entry)} x2={width} y2={getY(entry)} stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="2,2" />
          )}

          {/* Price Labels */}
          {tgt > 0 && <text x={width - 50} y={getY(tgt) - 8} fill="var(--success)" fontSize="12" fontWeight="bold">TGT: ₹{tgt.toFixed(2)}</text>}
          {sl > 0 && <text x={width - 50} y={getY(sl) + 16} fill="var(--danger)" fontSize="12" fontWeight="bold">SL: ₹{sl.toFixed(2)}</text>}
          {entry > 0 && <text x={10} y={getY(entry) - 8} fill="var(--accent)" fontSize="12" fontWeight="bold">{trade.entryPrice ? 'ENTRY' : 'PRICE'}: ₹{entry.toFixed(2)}</text>}

          {/* Time Labels */}
          {validIndices.filter((_, i) => i % Math.max(1, Math.floor(validIndices.length/6)) === 0).map((idx, i) => {
            const x = (validIndices.indexOf(idx) / (validIndices.length - 1)) * (width - 20) + 10;
            const dateObj = new Date(chartData.timestamp[idx] * 1000);
            const timeStr = range === '1d' 
              ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
              : dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
            return (
              <text key={idx} x={x} y={height + 30} fill="var(--text-secondary)" fontSize="11" fontWeight="600" textAnchor="middle">{timeStr}</text>
            );
          })}

          {/* Candles */}
          {validIndices.map((idx, i) => {
            const x = (i / (validIndices.length - 1)) * (width - 20) + 10;
            const candleWidth = Math.max(2, (width / validIndices.length) * 0.7);
            const o = open[idx], h = high[idx], l = low[idx], c = close[idx];
            const isUp = c >= o;
            const color = isUp ? '#10b981' : '#ef4444';
            
            return (
              <g key={idx}>
                <line x1={x} y1={getY(h)} x2={x} y2={getY(l)} stroke={color} strokeWidth="1" />
                <rect 
                  x={x - candleWidth/2} 
                  y={isUp ? getY(c) : getY(o)} 
                  width={candleWidth} 
                  height={Math.max(1, Math.abs(getY(c) - getY(o)))} 
                  fill={color} 
                />
              </g>
            );
          })}
        </svg>
        
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '40px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <div style={{ display: 'flex', gap: '30px' }}>
            <span style={{ color: '#10b981', fontWeight: 'bold' }}>▲ Daily High: ₹{candleMax.toFixed(2)}</span>
            <span style={{ color: '#ef4444', fontWeight: 'bold' }}>▼ Daily Low: ₹{candleMin.toFixed(2)}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={onClose}>
      <div style={{ background: 'var(--panel-bg)', border: '1px solid var(--border)', width: '900px', maxWidth: '95%', borderRadius: '16px', padding: '30px', position: 'relative' }} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', zIndex: 10 }}><X size={24} /></button>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
             <Activity size={24} color="var(--accent)" />
             <div>
               <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>{trade.symbol} Chart</h2>
               {trade.status && (
                 <span className={`badge ${trade.status === 'Success' ? 'bg-success' : 'bg-warning'}`} style={{ marginTop: '5px' }}>{trade.status.toUpperCase()}</span>
               )}
             </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '4px' }}>
              {tfOptions.map(opt => (
                <button
                  key={opt.label}
                  onClick={() => handleTFChange(opt)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    background: range === opt.range ? 'var(--accent)' : 'transparent',
                    color: 'white',
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div style={{ paddingRight: '40px' }}>
                <button 
                  onClick={() => fetchChart(true)} 
                  disabled={isRefreshing}
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '50%', width: '40px', height: '40px', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                  title="Refresh Chart"
                >
                  <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
                </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
             <RefreshCw className="animate-spin" size={30} color="var(--accent)" />
          </div>
        ) : renderCandles()}
        
        <div style={{ marginTop: '25px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', padding: '20px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
           <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{trade.entryPrice ? 'Entry' : 'Current'} Price</div>
              <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>₹{(trade.entryPrice || trade.currentPrice || 0).toFixed(2)}</div>
           </div>
           <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Target Price</div>
              <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--success)' }}>{trade.targetPrice > 0 ? `₹${trade.targetPrice.toFixed(2)}` : 'N/A'}</div>
           </div>
           <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Stop Loss</div>
              <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--danger)' }}>{trade.stopLossPrice > 0 ? `₹${trade.stopLossPrice.toFixed(2)}` : 'N/A'}</div>
           </div>
           <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{trade.exitPrice > 0 ? 'Exit Price' : 'Quantity'}</div>
              <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{trade.exitPrice > 0 ? `₹${trade.exitPrice.toFixed(2)}` : trade.quantity || 1}</div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default CandleChartModal;
