import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Activity, Briefcase, TrendingUp, PieChart, Clock, ShoppingBag, Target } from 'lucide-react';

export default function Navbar() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('username');

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  if (!token) return null;

  return (
    <nav className="navbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Activity color="#3b82f6" fill="rgba(59, 130, 246, 0.2)" size={32} />
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700' }}>TradeProX</h1>
      </div>
      <div className="nav-links">
        <Link to="/" className="nav-link" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Briefcase size={20} />
          Portfolio
        </Link>
        <Link to="/trade" className="nav-link" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TrendingUp size={20} />
          Trade & Research
        </Link>
        <Link to="/hot-stocks" className="nav-link" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={20} />
          Hot Stocks
        </Link>
        <Link to="/strategy" className="nav-link" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Target size={20} />
          Strategies
        </Link>
        <Link to="/profit-loss" className="nav-link" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <PieChart size={20} />
          Profit & Loss
        </Link>
        <Link to="/orders" className="nav-link" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={20} />
          Orders
        </Link>
        <span style={{ color: 'var(--text-secondary)' }}>|</span>
        <span style={{ fontWeight: '500' }}>Hello, {user}</span>
        <button className="btn btn-danger" onClick={handleLogout} style={{ padding: '6px 12px', fontSize: '0.875rem' }}>
          <LogOut size={16} /> Logout
        </button>
      </div>
    </nav>
  );
}
