import React, { useState, useEffect } from 'react';
import API_BASE_URL from './apiConfig';
import { RefreshCw, Search, Plus, Trash, CheckCircle, Info, Eye, Copy, X, TrendingUp, BarChart2, Activity, Compass, Calendar } from 'lucide-react';
import CandleChartModal from './components/CandleChartModal';

const Strategy = () => {
  const [strategies, setStrategies] = useState([]);
  const [expandedRows, setExpandedRows] = useState({});
  const [refreshingRows, setRefreshingRows] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [listType, setListType] = useState('gainers');
  const [nseList, setNseList] = useState([]);
  const [nseLoading, setNseLoading] = useState(false);
  const [editId, setEditId] = useState(null);
  const [executionHistory, setExecutionHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState(null);
  const [isFormExpanded, setIsFormExpanded] = useState(false);
  const [logSortBy, setLogSortBy] = useState('time'); // 'time' or 'symbol'

  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [pythonLogs, setPythonLogs] = useState('');
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logStrategyId, setLogStrategyId] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    stockSource: 'gainers',
    scheduledTime: '09:15',
    endTime: '15:15',
    selectionReasoning: '',
    entryPrice: 1.0,
    stopLoss: 1.5,
    targetPrice: 3.0,
    analysisReasoning: '',
    triggerCondition: 'Immediate',
    minVolatility: '',
    maxVolatility: '',
    useVolatilityForSlTgt: false,
    type: 'Buy',
    quantity: '',
    allocationLimit: '',
    totalAmount: '',
    minProfitBooking: '',
    checkVolumeSurge: false,
    volumeSurgeRatio: 1.5,
    checkBreakout: false,
    checkBreakout: false,
    timeframe: '15m',
    lookbackPeriod: 20,
    maxStocks: 5,
    isActive: true,
    useChartAnalyser: false,
    analysisDuration: 60,
    predictSlAndTarget: false
  });

  const [message, setMessage] = useState(null);
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    fetchStrategies();
    fetchWatchlists();
    fetchNseList('gainers');
    fetchExecutionHistory();
  }, []);

  const fetchWatchlists = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/watchlist`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        const uniqueGroups = [...new Set(data.map(i => i.watchlistName))];
        setGroups(uniqueGroups);
      }
    } catch (err) { console.error('Failed to fetch watchlists:', err); }
  };

  const fetchStrategies = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/strategy`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setStrategies(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch strategies:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async (strategyId = null) => {
    setLogsModalOpen(true);
    setLoadingLogs(true);
    setLogStrategyId(strategyId);
    try {
      let url = `${API_BASE_URL}/api/strategy/python-logs`;
      if (strategyId) url += `?strategy_id=${strategyId}`;
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
      if (res.ok) {
        const data = await res.json();
        setPythonLogs(data.logs || '');
      } else {
        setPythonLogs('Error: fetching logs failed.');
      }
    } catch (e) {
      setPythonLogs('Error: Network error.');
    } finally {
      setLoadingLogs(false);
    }
  };

  const getParsedLogs = () => {
    if (!pythonLogs) return {};
    let parsedArr = [];
    if (pythonLogs.startsWith('Error:')) {
       parsedArr = [{ id: 0, isError: true, message: pythonLogs, date: 'System Diagnostics', time: '' }];
    } else if (pythonLogs.includes('No Python analysis logs')) {
       parsedArr = [{ id: 0, message: pythonLogs, date: 'Initial Logs', time: '' }];
    } else {
      parsedArr = pythonLogs.split('\n').filter(l => l.trim().length > 0).map((line, idx) => {
        const dualTimeMatch = line.match(/^\[Start: (.*?)\] \[Last: (.*?)\]\s*(.*)/);
        const legacyTimeMatch = line.match(/^\[(.*?)\]\s*(.*)/);
        
        let date = 'Unknown Date';
        let time = '';
        let startTime = '';
        let lastTime = '';
        let rest = line;

        if (dualTimeMatch) {
            startTime = dualTimeMatch[1];
            lastTime = dualTimeMatch[2];
            const tParts = lastTime.split(' ');
            date = tParts[0];
            time = tParts.slice(1).join(' ');
            rest = dualTimeMatch[3];
        } else if (legacyTimeMatch) {
            const timestamp = legacyTimeMatch[1];
            const tParts = timestamp.split(' ');
            if (tParts.length >= 2) {
                date = tParts[0];
                time = tParts.slice(1).join(' ');
            } else {
                date = timestamp;
            }
            rest = legacyTimeMatch[2];
            lastTime = timestamp;
        }
        
        const parts = rest.split(' | ');
        let strategy = '';
        let symbol = '';
        let message = '';
        let isError = false;
        let opportunity = '';
        let reason = '';
        let stats = {};

        parts.forEach(p => {
          p = p.trim();
          if (p.startsWith('Strategy:')) strategy = p.replace('Strategy:', '').trim();
          else if (p.startsWith('Symbol:')) symbol = p.replace('Symbol:', '').trim();
          else if (p.startsWith('Error:')) { isError = true; message = p; }
          else if (p.startsWith('Added ') || p.startsWith('Error ') || p.startsWith('YFinance')) { message = p; }
          else if (p.startsWith('Opportunity:')) opportunity = p.replace('Opportunity:', '').trim();
          else if (p.startsWith('Reason:')) reason = p.replace('Reason:', '').trim();
          else {
             if (p.includes(':')) {
                const [k, v] = p.split(':');
                stats[k.trim()] = v.trim();
             } else {
                if (message) message += ' | ' + p;
                else message = p;
             }
          }
        });
        return { 
          id: idx, date, time, startTime, lastExecTime: lastTime, 
          strategy, symbol, message, isError, opportunity, stats, reason, 
          rawDate: date + ' ' + time 
        };
      }).reverse();
    }

    if (logSortBy === 'symbol') {
      parsedArr.sort((a, b) => a.symbol.localeCompare(b.symbol) || b.rawDate.localeCompare(a.rawDate));
    }

    return parsedArr.reduce((groups, log) => {
        const key = logSortBy === 'symbol' ? log.symbol : log.date;
        if (!groups[key]) groups[key] = [];
        groups[key].push(log);
        return groups;
    }, {});
  };

  const fetchExecutionHistory = async () => {
    setHistoryLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/strategy/execution-status`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setExecutionHistory(data || []);
      }
    } catch (error) {
      console.error('Error fetching execution history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleRefreshRow = async (e, key) => {
    e.stopPropagation();
    setRefreshingRows(p => ({ ...p, [key]: true }));
    await fetchExecutionHistory();
    setTimeout(() => {
       setRefreshingRows(p => ({ ...p, [key]: false }));
    }, 600);
  };

  const fetchNseList = async (type) => {
    setNseLoading(true);
    setListType(type);
    try {
      let endpoint = '';
      if (type === 'gainers') endpoint = '/api/marketdata/nse/gainers';
      else if (type === 'losers') endpoint = '/api/marketdata/nse/losers';
      else if (type === 'volumespurts') endpoint = '/api/marketdata/nse/volumespurts';
      else if (type === 'mostactive') endpoint = '/api/marketdata/nse/mostactive';

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        const list = data.data || data;
        setNseList(Array.isArray(list) ? list : []);
      }
    } catch (error) {
      console.error('Error fetching NSE list:', error);
    } finally {
      setNseLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const payload = {
      ...formData,
      entryPrice: parseFloat(formData.entryPrice) || 0,
      stopLoss: parseFloat(formData.stopLoss) || 0,
      targetPrice: parseFloat(formData.targetPrice) || 0,
      quantity: formData.quantity ? parseFloat(formData.quantity) : null,
      allocationLimit: formData.allocationLimit ? parseFloat(formData.allocationLimit) : null,
      totalAmount: formData.totalAmount ? parseFloat(formData.totalAmount) : null,
      minProfitBooking: formData.minProfitBooking ? parseFloat(formData.minProfitBooking) : null,
      checkVolumeSurge: formData.checkVolumeSurge,
      volumeSurgeRatio: parseFloat(formData.volumeSurgeRatio) || 1.5,
      checkBreakout: formData.checkBreakout,
      timeframe: formData.timeframe || '15m',
      lookbackPeriod: parseInt(formData.lookbackPeriod) || 20,
      minVolatility: formData.minVolatility ? parseFloat(formData.minVolatility) : null,
      maxVolatility: formData.maxVolatility ? parseFloat(formData.maxVolatility) : null,
      useVolatilityForSlTgt: formData.useVolatilityForSlTgt,
      maxStocks: parseInt(formData.maxStocks) || 5,
      useChartAnalyser: formData.useChartAnalyser,
      analysisDuration: parseInt(formData.analysisDuration) || 60,
      predictSlAndTarget: formData.predictSlAndTarget,
      watchlistGroup: formData.watchlistGroup
    };

    const url = editId ? `${API_BASE_URL}/api/strategy/${editId}` : `${API_BASE_URL}/api/strategy`;
    const method = editId ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        if (!editId && data && data.id) {
           setEditId(data.id);
        }
        setMessage({ type: 'success', text: `Engine "${formData.name}" ${editId ? 'updated' : 'scheduled'} successfully!` });
        fetchStrategies();
      } else {
        setMessage({ type: 'danger', text: `Error ${editId ? 'updating' : 'scheduling'} engine.` });
      }
    } catch (err) {
      setMessage({ type: 'danger', text: 'Network error.' });
    }
    setSubmitting(false);
  };

  const resetForm = () => {
    setEditId(null);
    setFormData({
      name: '', stockSource: 'gainers', scheduledTime: '09:15', endTime: '15:15',
      selectionReasoning: '', entryPrice: 1.0, stopLoss: 1.5, targetPrice: 3.0,
      analysisReasoning: '', triggerCondition: 'Immediate', type: 'Buy',
      minVolatility: '', maxVolatility: '', useVolatilityForSlTgt: false,
      useConfidence: false, minConfidence: 70, squareOffAtEndTime: false,
      quantity: '', allocationLimit: '', totalAmount: '', minProfitBooking: '', 
      maxStocks: 5, isActive: true, useChartAnalyser: false, analysisDuration: 60, predictSlAndTarget: false, watchlistGroup: ''
    });
  };

  const handleEditClick = (s) => {
    setEditId(s.id);
    setIsFormExpanded(true);
    setFormData({
      ...s,
      quantity: s.quantity || '',
      allocationLimit: s.allocationLimit || '',
      totalAmount: s.totalAmount || '',
      minProfitBooking: s.minProfitBooking || '',
      checkVolumeSurge: s.checkVolumeSurge || false,
      volumeSurgeRatio: s.volumeSurgeRatio || 1.5,
      checkBreakout: s.checkBreakout || false,
      timeframe: s.timeframe || '15m',
      lookbackPeriod: s.lookbackPeriod || 20,
      minVolatility: s.minVolatility || '',
      maxVolatility: s.maxVolatility || '',
      useVolatilityForSlTgt: s.useVolatilityForSlTgt || false,
      useConfidence: s.useConfidence || false,
      minConfidence: s.minConfidence || 70,
      squareOffAtEndTime: s.squareOffAtEndTime || false,
      useChartAnalyser: s.useChartAnalyser || false,
      analysisDuration: s.analysisDuration || 60,
      predictSlAndTarget: s.predictSlAndTarget || false
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteStrategy = async (id) => {
    if (!window.confirm('Are you sure you want to delete this strategy?')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/strategy/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        fetchStrategies();
        if (editId === id) {
          resetForm();
          setIsFormExpanded(false);
        }
      }
    } catch (error) { console.error('Error deleting strategy:', error); }
  };

  const cloneStrategy = async (s) => {
    try {
      const cloned = {
        ...s,
        id: undefined,
        name: `${s.name} Clone -1`,
        isActive: false
      };

      const response = await fetch(`${API_BASE_URL}/api/strategy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(cloned)
      });
      if (response.ok) {
        setMessage({ type: 'success', text: `Engine "${s.name}" cloned successfully!` });
        fetchStrategies();
      } else {
        setMessage({ type: 'danger', text: 'Error cloning engine.' });
      }
    } catch (error) { console.error('Error cloning strategy:', error); }
  };

  const toggleStatus = async (s) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/strategy/${s.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ ...s, isActive: !s.isActive })
      });
      if (res.ok) fetchStrategies();
    } catch (err) { console.error('Error toggling status:', err); }
  };

  const consolidatedReport = [...executionHistory].reduce((acc, curr) => {
    const date = new Date(curr.executionDate).toLocaleDateString();
    const key = `${date}_${curr.strategyId}`;
    
    if (!acc[key]) {
      acc[key] = {
        date: date,
        rawDate: curr.executionDate,
        strategyName: strategies.find(s => s.id === curr.strategyId)?.name || 'Default Strategy',
        strategyTotalAmount: strategies.find(s => s.id === curr.strategyId)?.totalAmount || 0,
        transactionsCount: 0,
        realizedPnl: 0,
        realizedInvested: 0,
        profitBookedCount: 0,
        leftInvestedValue: 0,
        symbolGroups: {},
        key: key
      };
    }
    
    const grp = acc[key];
    const sKey = curr.symbol;
    if (!grp.symbolGroups[sKey]) {
      grp.symbolGroups[sKey] = {
        symbol: curr.symbol,
        status: curr.status,
        executionDate: curr.executionDate,
        entryPrice: curr.entryPrice,
        exitPrice: curr.exitPrice,
        targetPrice: curr.targetPrice,
        stopLossPrice: curr.stopLossPrice,
        quantity: 0,
        profitLoss: 0,
        invested: 0,
        transactions: []
      };
    }
    
    const sGrp = grp.symbolGroups[sKey];
    sGrp.transactions.push(curr);
    
    if (!sGrp.totalInvested) sGrp.totalInvested = 0;
    if (!sGrp.totalQty) sGrp.totalQty = 0;
    
    sGrp.totalInvested += (curr.entryPrice * curr.quantity);
    sGrp.totalQty += curr.quantity;
    sGrp.entryPrice = sGrp.totalInvested / sGrp.totalQty;
    sGrp.quantity = Math.max(sGrp.quantity, curr.quantity);
    
    sGrp.profitLoss += curr.profitLoss;
    
    if (new Date(curr.executionDate) > (sGrp.lastUpdate ? new Date(sGrp.lastUpdate) : 0)) {
        sGrp.status = curr.status;
        sGrp.lastUpdate = curr.executionDate;
        sGrp.executionDate = curr.executionDate;
        if (curr.targetPrice) sGrp.targetPrice = curr.targetPrice;
        if (curr.stopLossPrice) sGrp.stopLossPrice = curr.stopLossPrice;
    }

    grp.transactionsCount = Object.keys(grp.symbolGroups).length;
    
    const invested = (curr.entryPrice || 0) * (curr.quantity || 1);
    
    if (curr.status === 'Active Trade') {
       grp.leftInvestedValue += invested;
    } else {
       grp.realizedPnl += curr.profitLoss;
       grp.realizedInvested += invested;
       if (curr.profitLoss > 0) grp.profitBookedCount += 1;
    }
    
    return acc;
  }, {});

  const reportItems = Object.values(consolidatedReport).map(r => ({
    ...r,
    transactions: Object.values(r.symbolGroups)
  })).sort((a,b) => new Date(b.rawDate) - new Date(a.rawDate));

  return (
    <div className="container" style={{ maxWidth: '1400px' }}>
      <h1 className="title" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        <Activity className="text-primary" size={32} /> Automated Trading Engines
        <button onClick={() => fetchLogs()} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto', fontSize: '1rem', padding: '10px 15px' }}>
          <Activity size={18} /> View AI Logs
        </button>
      </h1>

      <div className="grid grid-cols-2" style={{ alignItems: 'start' }}>

        <div>
          <div className="glass-panel" style={{ minHeight: '600px' }}>
            <h2 className="subtitle">Active Scheduled Engines</h2>
            {loading ? (
              <div className="animate-pulse">Accessing scheduler...</div>
            ) : strategies.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <p>No automated rules currently active.</p>
                <p style={{ fontSize: '0.8rem', marginTop: '10px' }}>Create your first engine on the right. ➡</p>
              </div>
            ) : (
              <div className="table-responsive">
                <div className="desktop-only">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Engine / Source</th>
                        <th>Schedule (Start-End)</th>
                        <th>Rule Parameters</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {strategies.map((s) => (
                        <tr key={s.id}>
                          <td>
                            <div style={{ fontWeight: 'bold', color: 'white', fontSize: '1.1rem' }}>{s.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--accent)' }}>
                              {s.stockSource} (Top {s.maxStocks})
                            </div>
                          </td>
                          <td>
                            <div style={{ fontSize: '0.9rem' }}>{s.scheduledTime} - {s.endTime}</div>
                            {s.lastRunDate && (
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                Last: {new Date(s.lastRunDate).toLocaleDateString()}
                              </div>
                            )}
                          </td>
                          <td>
                            <div style={{ fontSize: '0.85rem' }}>
                              <span className={s.type === 'Buy' ? 'text-success' : 'text-danger'}>{s.type}</span>
                              {s.quantity ? ` ${s.quantity} Qty` : s.allocationLimit ? ` ₹${s.allocationLimit} Per Stock` : ''}
                              {s.totalAmount ? ` (₹${s.totalAmount} Max)` : ' (Auto)'}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              Entry: {s.entryPrice}x | Tgt: {s.targetPrice}%
                            </div>
                          </td>
                          <td>
                            <button
                              onClick={() => toggleStatus(s)}
                              className={s.isActive ? 'text-success' : 'text-secondary'}
                              style={{
                                fontSize: '0.75rem',
                                border: '1px solid currentColor',
                                padding: '2px 10px',
                                borderRadius: '12px',
                                background: 'transparent',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                              }}
                            >
                              {s.isActive ? 'ACTIVE' : 'PAUSED'}
                            </button>
                          </td>
                          <td style={{ padding: '15px' }}>
                            <div style={{ display: 'flex', gap: '10px' }}>
                              <button onClick={() => handleEditClick(s)} className="btn btn-primary" title="View / Edit" style={{ padding: '8px', flex: 1, display: 'flex', justifyContent: 'center' }}>
                                <Eye size={18} />
                              </button>
                              <button onClick={() => fetchLogs(s.id)} className="btn btn-outline" title="AI Logs" style={{ padding: '8px', flex: 1, display: 'flex', justifyContent: 'center' }}>
                                <Activity size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mobile-only card-view">
                  {strategies.map((s) => (
                    <div key={s.id} className="mobile-table-card">
                      <div className="card-row">
                        <div>
                          <div style={{ fontWeight: 'bold', color: 'var(--accent)', fontSize: '1.1rem' }}>{s.name}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{s.stockSource}</div>
                        </div>
                        <button
                          onClick={() => toggleStatus(s)}
                          className={s.isActive ? 'text-success' : 'text-secondary'}
                          style={{
                            fontSize: '0.65rem',
                            border: '1px solid currentColor',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            background: 'transparent',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                          }}
                        >
                          {s.isActive ? 'ACTIVE' : 'PAUSED'}
                        </button>
                      </div>
                      <div className="card-row" style={{ marginTop: '10px' }}>
                        <div>
                          <span className="label">Schedule</span>
                          <div className="value" style={{ fontSize: '0.85rem' }}>{s.scheduledTime} - {s.endTime}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span className="label">Rules</span>
                          <div className="value" style={{ fontSize: '0.85rem' }}>
                            <span className={s.type === 'Buy' ? 'text-success' : 'text-danger'}>{s.type}</span> | T:{s.targetPrice}%
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <button onClick={() => handleEditClick(s)} className="btn btn-primary" style={{ flex: 1, padding: '6px', fontSize: '0.8rem', gap: '4px' }}>
                          <Eye size={14} /> EDIT
                        </button>
                        <button onClick={() => fetchLogs(s.id)} className="btn btn-outline" style={{ flex: 1, padding: '6px', fontSize: '0.8rem', gap: '4px' }}>
                          <Activity size={14} /> LOGS
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div>
          {!isFormExpanded ? (
            <div className="glass-panel" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '600px', flexDirection: 'column', gap: '20px' }}>
              <Compass size={64} style={{ opacity: 0.3 }} />
              <button 
                onClick={() => { resetForm(); setMessage(null); setIsFormExpanded(true); }} 
                className="btn btn-primary" 
                style={{ padding: '15px 30px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px' }}
              >
                <Plus size={24} /> Create New Engine
              </button>
            </div>
          ) : (
            <div className="glass-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <h2 className="subtitle" style={{ margin: 0 }}>{editId ? `Editing: ${formData.name}` : 'Configure New Engine'}</h2>
                <button onClick={() => setIsFormExpanded(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '5px' }}>
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleSubmit}>
              {message && (
                <div className={`text-${message.type}`} style={{ marginBottom: '20px', fontWeight: 'bold', padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)' }}>
                  {message.text}
                </div>
              )}

              <div style={{ padding: '20px', border: '1px solid var(--border)', borderRadius: '12px', marginBottom: '20px', background: 'rgba(59, 130, 246, 0.05)' }}>
                <h3 style={{ marginBottom: '15px', color: 'var(--accent)', fontSize: '0.9rem', textTransform: 'uppercase' }}>Section 1: Automation Hub</h3>

                <div className="form-group">
                  <label>Engine Name</label>
                  <input type="text" name="name" className="form-control" value={formData.name} onChange={handleChange} placeholder="e.g. Nifty Breakout Bot" required />
                </div>

                <div className="form-group" style={{ marginBottom: '15px' }}>
                  <select name="stockSource" className="form-control" value={formData.stockSource} onChange={handleChange}>
                    <option value="gainers">Top Gainers</option>
                    <option value="losers">Top Losers</option>
                    <option value="volumespurts">Volume Gainers</option>
                    <option value="watchlist">Custom Watchlist</option>
                  </select>
                </div>
                {formData.stockSource === 'watchlist' && (
                  <div className="form-group slide-down">
                    <label>Select Watchlist Group</label>
                    <select name="watchlistGroup" className="form-control" value={formData.watchlistGroup || ''} onChange={handleChange}>
                      <option value="">All Watchlist Stocks</option>
                      {groups.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2">
                  <div className="form-group">
                    <label>Start Time (Daily)</label>
                    <input type="time" name="scheduledTime" className="form-control" value={formData.scheduledTime} onChange={handleChange} required />
                  </div>
                  <div className="form-group">
                    <label>End Time</label>
                    <input type="time" name="endTime" className="form-control" value={formData.endTime} onChange={handleChange} required />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                      <input type="checkbox" name="squareOffAtEndTime" checked={formData.squareOffAtEndTime} onChange={handleChange} style={{ cursor: 'pointer' }} />
                      <label style={{ margin: 0, fontSize: '0.75rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>Auto Square-Off at End Time</label>
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label>Strategy Reasoning (Optional)</label>
                  <textarea
                    name="selectionReasoning"
                    className="form-control"
                    rows="2"
                    placeholder="Describe the intention behind this engine..."
                    value={formData.selectionReasoning}
                    onChange={handleChange}
                  ></textarea>
                </div>
              </div>

              <div style={{ padding: '20px', border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '20px' }}>
                <h3 style={{ marginBottom: '15px', color: 'var(--accent)', fontSize: '0.9rem', textTransform: 'uppercase' }}>Section 2: Pricing & Multipliers</h3>

                <div className="grid grid-cols-3">
                  <div className="form-group">
                    <label>Entry Multiplier</label>
                    <input type="number" step="0.01" name="entryPrice" className="form-control" value={formData.entryPrice} onChange={handleChange} placeholder="1.0" required />
                  </div>
                  <div className="form-group">
                    <label>{formData.useVolatilityForSlTgt ? 'SL Vol. Mult.' : 'SL (%)'}</label>
                    <input type="number" step="0.01" name="stopLoss" className="form-control" value={formData.stopLoss} onChange={handleChange} placeholder="1.5" required />
                  </div>
                  <div className="form-group">
                    <label>{formData.useVolatilityForSlTgt ? 'Tgt Vol. Mult.' : 'Target (%)'}</label>
                    <input type="number" step="0.01" name="targetPrice" className="form-control" value={formData.targetPrice} onChange={handleChange} placeholder="3.0" required />
                  </div>
                </div>

                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px' }}>
                  <input type="checkbox" name="useVolatilityForSlTgt" checked={formData.useVolatilityForSlTgt} onChange={handleChange} style={{ width: '20px', height: '20px' }} />
                  <label style={{ margin: 0, display: 'inline', cursor: 'pointer', fontSize: '0.85rem' }}>Use Volatility Multipliers for SL/Target (Target = Volatility * Mult)</label>
                </div>
              </div>

              <div style={{ padding: '20px', border: '1px solid var(--border)', borderRadius: '12px', marginBottom: '20px', background: 'rgba(59, 130, 246, 0.02)' }}>
                <h3 style={{ marginBottom: '15px', color: 'var(--accent)', fontSize: '0.9rem', textTransform: 'uppercase' }}>Section 3: Technical & Risk Filters</h3>
                
                <div className="grid grid-cols-2" style={{ marginBottom: '12px', gap: '20px' }}>
                  <div className="form-group">
                    <label>Min Volatility (%) (Optional)</label>
                    <input type="number" step="0.01" name="minVolatility" className="form-control" value={formData.minVolatility} onChange={handleChange} placeholder="e.g. 1.0" />
                  </div>
                  <div className="form-group">
                    <label>Max Volatility (%) (Optional)</label>
                    <input type="number" step="0.01" name="maxVolatility" className="form-control" value={formData.maxVolatility} onChange={handleChange} placeholder="e.g. 5.0" />
                  </div>
                </div>

                <div className="grid grid-cols-2" style={{ marginBottom: '12px', gap: '20px', alignItems: 'end' }}>
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '10px' }}>
                     <input type="checkbox" name="checkVolumeSurge" checked={formData.checkVolumeSurge} onChange={handleChange} style={{ width: '18px', height: '18px' }} id="checkVolumeSurge" />
                     <label htmlFor="checkVolumeSurge" style={{ margin: 0, fontSize: '0.85rem', cursor: 'pointer' }}>Check for Volume Surge</label>
                  </div>
                  <div className="form-group" style={{ visibility: formData.checkVolumeSurge ? 'visible' : 'hidden' }}>
                    <label>Volume Surge Ratio (vs Average)</label>
                    <input type="number" step="0.1" name="volumeSurgeRatio" className="form-control" value={formData.volumeSurgeRatio} onChange={handleChange} placeholder="1.5" />
                  </div>
                </div>

                <div className="grid grid-cols-2" style={{ marginBottom: '12px', gap: '20px', alignItems: 'end' }}>
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '10px' }}>
                     <input type="checkbox" name="checkBreakout" checked={formData.checkBreakout} onChange={handleChange} style={{ width: '18px', height: '18px' }} id="checkBreakout" />
                     <label htmlFor="checkBreakout" style={{ margin: 0, fontSize: '0.85rem', cursor: 'pointer' }}>Check for Breakout/Breakdown</label>
                  </div>
                  <div className="grid grid-cols-2" style={{ gap: '10px' }}>
                    <div className="form-group">
                      <label style={{ opacity: (formData.checkBreakout || formData.checkVolumeSurge) ? 1 : 0.5 }}>Timeframe</label>
                      <select 
                        name="timeframe" 
                        className="form-control" 
                        value={formData.timeframe} 
                        onChange={handleChange} 
                        disabled={!(formData.checkBreakout || formData.checkVolumeSurge)} 
                      >
                        <option value="1m">1 Minute</option>
                        <option value="5m">5 Minutes</option>
                        <option value="15m">15 Minutes</option>
                        <option value="1h">1 Hour</option>
                        <option value="1d">1 Day</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label style={{ opacity: (formData.checkBreakout || formData.checkVolumeSurge) ? 1 : 0.5 }}>Lookback (Candles)</label>
                      <input 
                        type="number" 
                        name="lookbackPeriod" 
                        className="form-control" 
                        value={formData.lookbackPeriod} 
                        onChange={handleChange} 
                        placeholder="20" 
                        min="1" 
                        disabled={!(formData.checkBreakout || formData.checkVolumeSurge)} 
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2" style={{ gap: '20px', alignItems: 'end' }}>
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '10px' }}>
                     <input type="checkbox" name="useConfidence" checked={formData.useConfidence} onChange={handleChange} style={{ width: '20px', height: '20px' }} id="useConfidence" />
                     <label htmlFor="useConfidence" style={{ margin: 0, display: 'inline', cursor: 'pointer', fontSize: '0.85rem' }}>Use Confidence Filter</label>
                  </div>
                  <div className="form-group" style={{ visibility: formData.useConfidence ? 'visible' : 'hidden' }}>
                    <label>Min Confidence %</label>
                    <input type="number" name="minConfidence" className="form-control" value={formData.minConfidence} onChange={handleChange} min="0" max="100" />
                  </div>
                </div>
              </div>

              <div style={{ padding: '20px', border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '20px' }}>
                <h3 style={{ marginBottom: '15px', color: 'var(--accent)', fontSize: '0.9rem', textTransform: 'uppercase' }}>Section 4: Risk & Execution</h3>
                <div className="grid grid-cols-2">
                  <div className="form-group">
                    <label>Trigger Behavior</label>
                    <select name="triggerCondition" className="form-control" value={formData.triggerCondition} onChange={handleChange}>
                      <option value="Price Below">Buy/Sell Below Entry</option>
                      <option value="Price Above">Buy/Sell Above Entry</option>
                      <option value="Immediate">Instant Execution</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Direction</label>
                    <select name="type" className="form-control" value={formData.type} onChange={handleChange}>
                      <option value="Buy">Long (Buy)</option>
                      <option value="Sell">Short (Sell)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ padding: '20px', border: '1px solid var(--border)', borderRadius: '12px', marginBottom: '20px', background: 'rgba(59, 130, 246, 0.02)' }}>
                <h3 style={{ marginBottom: '15px', color: 'var(--accent)', fontSize: '0.9rem', textTransform: 'uppercase' }}>Section 5: Budget & Sizing Restrictions</h3>

                <div className="grid grid-cols-2">
                  <div className="form-group">
                    <label>Fixed Quantity (Optional)</label>
                    <input type="number" name="quantity" className="form-control" value={formData.quantity} onChange={handleChange} placeholder="e.g. 10" />
                  </div>
                  <div className="form-group">
                    <label>Budget per Stock (Optional)</label>
                    <input type="number" name="allocationLimit" className="form-control" value={formData.allocationLimit} onChange={handleChange} placeholder="e.g. 5000" />
                  </div>
                </div>

                <div className="grid grid-cols-2">
                  <div className="form-group">
                    <label>Max Stocks to Pick & Trade</label>
                    <input type="number" name="maxStocks" className="form-control" value={formData.maxStocks} onChange={handleChange} min="1" max="20" required />
                  </div>
                  <div className="form-group">
                    <label>Total Strategy Limit (Max Amount)</label>
                    <input type="number" name="totalAmount" className="form-control" value={formData.totalAmount} onChange={handleChange} placeholder="e.g. 100000" />
                  </div>
                </div>

                <div className="grid grid-cols-2">
                  <div className="form-group">
                    <label>Min Profit Booking ₹ (Optional)</label>
                    <input type="number" name="minProfitBooking" className="form-control" value={formData.minProfitBooking} onChange={handleChange} placeholder="e.g. 500" title="Automatically pushes targets out to guarantee this absolute minimum profit amount if initial targets fall short." />
                  </div>
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '15px' }}>
                    <input type="checkbox" name="isActive" checked={formData.isActive} onChange={handleChange} style={{ width: '20px', height: '20px' }} />
                    <label style={{ margin: 0, display: 'inline', cursor: 'pointer', fontSize: '0.9rem' }}>Enable Trading Engine (Active)</label>
                  </div>
                </div>
              </div>

              <div style={{ padding: '20px', border: '1px solid var(--border)', borderRadius: '12px', marginBottom: '20px', background: 'rgba(16, 185, 129, 0.05)' }}>
                <h3 style={{ marginBottom: '15px', color: 'var(--success)', fontSize: '0.9rem', textTransform: 'uppercase' }}>Section 6: Python AI Chart Analyzer</h3>

                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '15px' }}>
                  <input type="checkbox" id="useChartAnalyser" name="useChartAnalyser" checked={formData.useChartAnalyser} onChange={handleChange} style={{ width: '20px', height: '20px' }} />
                  <label htmlFor="useChartAnalyser" style={{ margin: 0, display: 'inline', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold' }}>Enable Python Chart Analysis Engine</label>
                </div>

                <div className="grid grid-cols-2" style={{ visibility: formData.useChartAnalyser ? 'visible' : 'hidden', gap: '20px' }}>
                  <div className="form-group">
                    <label>Analysis Timeout (Minutes)</label>
                    <input 
                      type="number" 
                      name="analysisDuration" 
                      className="form-control" 
                      value={formData.analysisDuration} 
                      onChange={handleChange} 
                      placeholder="60"
                      min="1"
                    />
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px' }}>How long the AI should watch this stock before giving up.</div>
                  </div>
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '28px' }}>
                    <input type="checkbox" id="predictSlAndTarget" name="predictSlAndTarget" checked={formData.predictSlAndTarget} onChange={handleChange} style={{ width: '18px', height: '18px' }} />
                    <label htmlFor="predictSlAndTarget" style={{ margin: 0, cursor: 'pointer', fontSize: '0.85rem' }}>Auto-Predict SL & Target (Support/Resistance)</label>
                  </div>
                </div>
              </div>

              <button type="submit" className="btn" disabled={submitting} style={{ width: '100%', padding: '16px', fontWeight: 'bold', fontSize: '1rem' }}>
                {submitting ? (editId ? 'Updating Bot...' : 'Initializing Bot...') : (editId ? 'Update Trading Engine' : 'Schedule Trading Engine')}
              </button>

              {editId && (
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button type="button" onClick={() => cloneStrategy(strategies.find(s => s.id === editId))} className="btn btn-outline" style={{ flex: 1, color: 'var(--success)', borderColor: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Copy size={18} style={{ marginRight: '5px' }} /> Clone
                  </button>
                  <button type="button" onClick={() => deleteStrategy(editId)} className="btn btn-danger" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--error)' }}>
                    <Trash size={18} style={{ marginRight: '5px' }} /> Delete
                  </button>
                  <button type="button" onClick={() => { resetForm(); setIsFormExpanded(false); }} className="btn btn-outline" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <X size={18} style={{ marginRight: '5px' }} /> Close
                  </button>
                </div>
              )}
            </form>
          </div>
          )}
        </div>

      </div>

      <div className="glass-panel" style={{ marginTop: '20px' }}>
        <h2 className="subtitle">Strategy Execution History (Performance & Status)</h2>
        {historyLoading ? (
          <div className="animate-pulse">Loading execution stats...</div>
        ) : executionHistory.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No execution data recorded yet. Engines must complete a trade cycle.
          </div>
        ) : (
          <div className="table-responsive">
            <div className="desktop-only">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Strategy Name</th>
                    <th style={{ textAlign: 'center' }}>Stocks Handled</th>
                    <th style={{ textAlign: 'right' }}>Booked P&L</th>
                    <th style={{ textAlign: 'center' }}>Profitable Trades</th>
                    <th style={{ textAlign: 'right' }}>Total Money Used & Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {reportItems.length === 0 ? (
                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>No data</td></tr>
                  ) : (
                    reportItems.map((r, i) => {
                      const gainPerc = r.realizedInvested > 0 ? ((r.realizedPnl / r.realizedInvested) * 100).toFixed(2) : 0;
                      const totalMoneyUsed = r.realizedInvested + r.leftInvestedValue;
                      const usedPerc = r.strategyTotalAmount > 0 ? ((totalMoneyUsed / r.strategyTotalAmount) * 100).toFixed(1) : 0;
                      
                      return (
                        <React.Fragment key={i}>
                          <tr onClick={() => setExpandedRows(prev => ({...prev, [r.key]: !prev[r.key]}))} style={{ cursor: 'pointer', background: expandedRows[r.key] ? 'rgba(255,255,255,0.05)' : 'transparent' }}>
                            <td style={{ fontWeight: 'bold', borderBottom: expandedRows[r.key] ? 'none' : '' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ display: 'inline-block', width: '20px', color: 'var(--accent)' }}>{expandedRows[r.key] ? '▼' : '▶'}</span>
                                {r.date}
                                <button 
                                  onClick={(e) => handleRefreshRow(e, r.key)} 
                                  style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', outline: 'none', padding: '2px', display: 'flex' }}
                                  title="Refetch and recalculate data"
                                >
                                  <RefreshCw size={14} className={refreshingRows[r.key] ? 'animate-spin' : ''} />
                                </button>
                              </div>
                            </td>
                            <td style={{ color: 'var(--accent)', fontWeight: 'bold', borderBottom: expandedRows[r.key] ? 'none' : '' }}>{r.strategyName}</td>
                            <td style={{ textAlign: 'center', borderBottom: expandedRows[r.key] ? 'none' : '' }}><span className="badge bg-secondary">{r.transactionsCount}</span></td>
                            <td className={r.realizedPnl >= 0 ? 'text-success' : 'text-danger'} style={{ fontWeight: 'bold', textAlign: 'right', borderBottom: expandedRows[r.key] ? 'none' : '' }}>
                                {r.realizedPnl >= 0 ? '+' : ''}₹{r.realizedPnl.toFixed(2)} 
                                <span style={{ fontSize: '0.75rem', opacity: 0.8, marginLeft: '6px' }}>
                                    ({gainPerc}%)
                                </span>
                            </td>
                            <td style={{ textAlign: 'center', borderBottom: expandedRows[r.key] ? 'none' : '' }}>
                                <span className="text-success" style={{ fontWeight: 'bold' }}>{r.profitBookedCount}</span>
                                <span style={{ fontSize: '0.75rem', opacity: 0.5, marginLeft: '4px' }}>out of {r.transactionsCount}</span>
                            </td>
                            <td style={{ textAlign: 'right', borderBottom: expandedRows[r.key] ? 'none' : '' }}>
                                <div style={{ fontWeight: 'bold', color: 'white' }}>₹{(totalMoneyUsed).toFixed(2)}</div>
                                {r.strategyTotalAmount > 0 && (
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                        {usedPerc}% of ₹{r.strategyTotalAmount} Limit
                                        <div style={{ width: '100%', background: 'rgba(255,255,255,0.1)', height: '4px', borderRadius: '2px', marginTop: '4px' }}>
                                            <div style={{ width: `${Math.min(usedPerc, 100)}%`, background: usedPerc > 90 ? 'var(--danger)' : 'var(--accent)', height: '100%', borderRadius: '2px' }}></div>
                                        </div>
                                    </div>
                                )}
                            </td>
                          </tr>
                          {expandedRows[r.key] && (
                            <tr style={{ background: 'rgba(0,0,0,0.3)' }}>
                              <td colSpan="6" style={{ padding: '0' }}>
                                <div style={{ padding: '15px 15px 25px 40px', borderLeft: '4px solid var(--accent)' }}>
                                  <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase' }}>Individual Transactions for {r.date}</h4>
                                  <table className="table" style={{ background: 'transparent', margin: 0, fontSize: '0.85rem' }}>
                                    <thead>
                                      <tr>
                                        <th>Time</th>
                                        <th>Symbol</th>
                                        <th>Status</th>
                                        <th>Traded Price</th>
                                        <th>Qty</th>
                                        <th style={{ textAlign: 'right' }}>Current P&L</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {r.transactions.map((t, idx) => (
                                        <tr key={idx}>
                                          <td>{new Date(t.executionDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                          <td style={{ fontWeight: 'bold', color: 'var(--accent)', cursor: 'pointer' }} onClick={() => setSelectedTrade(t)}>
                                            <BarChart2 size={14} style={{ marginRight: '4px' }} /> {t.symbol}
                                          </td>
                                          <td>
                                            <span className={`badge ${t.status === 'Success' ? 'bg-success' : (t.status === 'Active Trade' ? 'bg-warning' : 'bg-danger')}`}>
                                              {t.status}
                                            </span>
                                          </td>
                                          <td>₹{t.entryPrice?.toFixed(2)}</td>
                                          <td>{t.quantity}</td>
                                          <td className={t.profitLoss >= 0 ? 'text-success' : 'text-danger'} style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                            {t.profitLoss >= 0 ? '+' : ''}₹{t.profitLoss?.toFixed(2)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="mobile-only card-view">
              {reportItems.map((r, i) => {
                const gainPerc = r.realizedInvested > 0 ? ((r.realizedPnl / r.realizedInvested) * 100).toFixed(1) : 0;
                return (
                  <div key={i} className="mobile-table-card" onClick={() => setExpandedRows(prev => ({...prev, [r.key]: !prev[r.key]}))}>
                    <div className="card-row">
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>{r.strategyName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{r.date}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className={r.realizedPnl >= 0 ? 'text-success' : 'text-danger'} style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                          {r.realizedPnl >= 0 ? '+' : ''}₹{r.realizedPnl.toFixed(0)}
                        </div>
                        <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>{gainPerc}%</div>
                      </div>
                    </div>
                    
                    {expandedRows[r.key] && (
                      <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                        {r.transactions.map((t, idx) => (
                          <div key={idx} style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: idx < r.transactions.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                            <div className="card-row">
                              <div style={{ fontWeight: 'bold', color: 'var(--accent)' }}>{t.symbol}</div>
                              <div className={t.profitLoss >= 0 ? 'text-success' : 'text-danger'} style={{ fontWeight: 'bold' }}>
                                {t.profitLoss >= 0 ? '+' : ''}₹{t.profitLoss.toFixed(1)}
                              </div>
                            </div>
                            <div className="card-row" style={{ marginTop: '4px' }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t.status}</span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t.quantity} @ ₹{t.entryPrice?.toFixed(1)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                      {expandedRows[r.key] ? '▲ Tap to collapse' : '▼ Tap to view details'}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {logsModalOpen && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="modal-content glass-panel" style={{ width: '95%', maxWidth: '1500px', padding: '30px', borderRadius: '12px', position: 'relative' }}>
            <button onClick={() => setLogsModalOpen(false)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'transparent', border: 'none', color: 'var(--text)', cursor: 'pointer' }}>
              <X size={24} />
            </button>
            <h2 className="subtitle" style={{ marginBottom: '20px' }}><Activity size={24} style={{ display: 'inline', marginRight: '10px' }} /> Python Analysis Engine Logs</h2>
            {loadingLogs ? (
              <div style={{ padding: '50px', textAlign: 'center' }}>Loading internal logs...</div>
            ) : (
              <div className="custom-scrollbar" style={{ maxHeight: '600px', overflowY: 'auto', background: 'var(--panel-bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div className="desktop-only">
                  <table style={{ width: '100%', fontSize: '0.85rem', textAlign: 'left', borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0, background: 'var(--panel-bg)', zIndex: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
                      <tr>
                        <th style={{ padding: '12px 15px', borderBottom: '1px solid var(--border)', width: '130px', cursor: 'pointer' }} onClick={() => setLogSortBy('time')}>
                           Start Time
                        </th>
                        <th style={{ padding: '12px 15px', borderBottom: '1px solid var(--border)', width: '130px' }}>
                           Last Execution {logSortBy === 'time' && '↓'}
                        </th>
                        {!logStrategyId && <th style={{ padding: '12px 15px', borderBottom: '1px solid var(--border)', width: '100px' }}>Strategy ID</th>}
                        <th style={{ padding: '12px 15px', borderBottom: '1px solid var(--border)', width: '120px', cursor: 'pointer' }} onClick={() => setLogSortBy('symbol')}>
                           Symbol {logSortBy === 'symbol' && '↕'}
                        </th>
                        <th style={{ padding: '12px 15px', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>Price</th>
                        <th style={{ padding: '12px 15px', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>EMA20</th>
                        <th style={{ padding: '12px 15px', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>Support</th>
                        <th style={{ padding: '12px 15px', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>Resistance</th>
                        <th style={{ padding: '12px 15px', borderBottom: '1px solid var(--border)', textAlign: 'right', whiteSpace: 'nowrap' }}>Volume</th>
                        <th style={{ padding: '12px 15px', borderBottom: '1px solid var(--border)', textAlign: 'right', whiteSpace: 'nowrap' }}>Vol Avg</th>
                        <th style={{ padding: '12px 15px', borderBottom: '1px solid var(--border)', width: '150px', textAlign: 'center' }}>Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.keys(getParsedLogs()).length === 0 ? (
                        <tr><td colSpan="11" style={{ padding: '30px', textAlign: 'center', opacity: 0.5 }}>No technical analysis events found recently...</td></tr>
                      ) : (
                        Object.entries(getParsedLogs()).map(([date, logs]) => (
                          <React.Fragment key={date}>
                            <tr style={{ background: 'rgba(59, 130, 246, 0.12)', borderBottom: '1px solid var(--border)' }}>
                              <td colSpan={logStrategyId ? 10 : 11} style={{ padding: '10px 15px', color: 'var(--accent)', fontWeight: 'bold', fontSize: '0.9rem' }}>
                                {logSortBy === 'symbol' ? (
                                  <span><Search size={14} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />SYMBOL: {date}</span>
                                ) : (
                                  <span><Calendar size={14} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
                                  {date}</span>
                                )}
                              </td>
                            </tr>
                            {logs.map((log) => {
                              const hasStats = log.stats && Object.keys(log.stats).length > 2;
                              return (
                                <tr key={log.id} style={{ 
                                  borderBottom: '1px solid var(--border)', 
                                  background: log.isError ? 'rgba(239, 68, 68, 0.15)' : (log.opportunity === 'True' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.05)'),
                                }}>
                                  <td style={{ padding: '12px 15px', whiteSpace: 'nowrap', opacity: 0.5, fontSize: '0.75rem', fontFamily: 'monospace' }}>{log.startTime ? log.startTime.split(' ')[1] : '-'}</td>
                                  <td style={{ padding: '12px 15px', whiteSpace: 'nowrap', opacity: 0.9, color: 'var(--accent)', fontWeight: 'bold', fontFamily: 'monospace' }}>{log.time || '-'}</td>
                                  {!logStrategyId && <td style={{ padding: '12px 15px', fontFamily: 'monospace', opacity: 0.5, fontSize: '0.8rem' }}>{log.strategy ? log.strategy.substring(0,8)+'...' : '-'}</td>}
                                  <td style={{ padding: '12px 15px', fontWeight: 'bold', color: 'var(--text)', fontSize: '1rem' }}>{log.symbol ? log.symbol.replace('.NS', '') : '-'}</td>
                                  
                                  {hasStats ? (
                                    <>
                                      <td style={{ padding: '12px 15px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.9rem' }}>{log.stats['Price'] || '-'}</td>
                                      <td style={{ padding: '12px 15px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.9rem' }}>{log.stats['EMA20'] || '-'}</td>
                                      <td style={{ padding: '12px 15px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.9rem' }}>{log.stats['Support'] || '-'}</td>
                                      <td style={{ padding: '12px 15px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.9rem' }}>{log.stats['Resistance'] || '-'}</td>
                                      <td style={{ padding: '12px 15px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.9rem' }}>{log.stats['Vol'] || '-'}</td>
                                      <td style={{ padding: '12px 15px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.9rem' }}>{log.stats['VolAvg'] || '-'}</td>
                                      <td style={{ padding: '12px 15px', fontWeight: 'bold', textAlign: 'center', minWidth: '150px' }}>
                                        {log.opportunity === 'True' ? (
                                           <div style={{ color: '#fff', background: 'var(--success)', padding: '4px 12px', borderRadius: '12px', fontSize: '0.7rem' }}>
                                             BUY SIGNAL
                                           </div>
                                        ) : (
                                           <span style={{ color: 'var(--error)', fontSize: '0.8rem' }}>{log.reason || 'REJECTED'}</span>
                                        )}
                                      </td>
                                    </>
                                  ) : (
                                    <td colSpan="7" style={{ padding: '12px 15px' }}>{log.message || log.reason || '-'}</td>
                                  )}
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mobile-only">
                  {Object.entries(getParsedLogs()).map(([date, logs]) => (
                    <div key={date}>
                      <div style={{ background: 'rgba(59, 130, 246, 0.2)', padding: '10px 15px', fontWeight: 'bold', fontSize: '0.9rem', position: 'sticky', top: 0, zIndex: 10 }}>
                        {date}
                      </div>
                      {logs.map((log) => (
                        <div key={log.id} style={{ 
                          padding: '15px', 
                          borderBottom: '1px solid var(--border)',
                          background: log.isError ? 'rgba(239, 68, 68, 0.1)' : (log.opportunity === 'True' ? 'rgba(16, 185, 129, 0.1)' : 'transparent')
                        }}>
                          <div className="card-row">
                            <span style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>{log.symbol?.replace('.NS', '')}</span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 'bold' }}>{log.time}</span>
                          </div>
                          {log.stats && Object.keys(log.stats).length > 2 ? (
                            <div style={{ marginTop: '10px', fontSize: '0.85rem' }}>
                              <div className="card-row">
                                <span>Price: ₹{log.stats['Price']}</span>
                                <span>Vol: {log.stats['Vol']}</span>
                              </div>
                              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                {log.opportunity === 'True' ? (
                                  <div style={{ color: 'var(--success)', fontWeight: 'bold' }}>✓ BUY SIGNAL IDENTIFIED</div>
                                ) : (
                                  <div style={{ color: 'var(--error)', fontSize: '0.8rem' }}>✗ {log.reason || 'Rejected by AI'}</div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div style={{ marginTop: '8px', fontSize: '0.85rem', opacity: 0.8 }}>{log.message || log.reason}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
               <button className="btn btn-outline" onClick={() => fetchLogs(logStrategyId)} style={{ marginRight: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <RefreshCw size={16} /> Refresh
              </button>
              <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', marginRight: '10px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                 <button 
                   className={`btn btn-sm ${logSortBy === 'time' ? 'btn-primary' : 'btn-ghost'}`}
                   onClick={() => setLogSortBy('time')}
                   style={{ borderRadius: 0, padding: '5px 15px', fontSize: '0.75rem' }}
                 >
                   Group by Date
                 </button>
                 <button 
                   className={`btn btn-sm ${logSortBy === 'symbol' ? 'btn-primary' : 'btn-ghost'}`}
                   onClick={() => setLogSortBy('symbol')}
                   style={{ borderRadius: 0, padding: '5px 15px', fontSize: '0.75rem' }}
                 >
                   Sort by Symbol
                 </button>
              </div>
              <button className="btn btn-primary" onClick={() => setLogsModalOpen(false)}>Close Window</button>
            </div>
          </div>
        </div>
      )}

      {selectedTrade && <CandleChartModal trade={selectedTrade} onClose={() => setSelectedTrade(null)} />}
    </div>
  );
};

export default Strategy;
