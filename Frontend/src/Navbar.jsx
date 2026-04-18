import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Activity, Briefcase, TrendingUp, PieChart, Clock, ShoppingBag, Target, Menu, X } from 'lucide-react';

export default function Navbar() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = React.useState(false);
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

      <button className="hamburger" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? <X size={32} /> : <Menu size={32} />}
      </button>

      <div className={`nav-links ${isOpen ? 'active' : ''}`} onClick={() => setIsOpen(false)}>
        <Link to="/" className="nav-link">
          <Briefcase size={20} />
          Portfolio
        </Link>
        <Link to="/trade" className="nav-link">
          <TrendingUp size={20} />
          Trade & Research
        </Link>
        <Link to="/hot-stocks" className="nav-link">
          <Activity size={20} />
          Hot Stocks
        </Link>
        <Link to="/strategy" className="nav-link">
          <Target size={20} />
          Strategies
        </Link>
        <Link to="/profit-loss" className="nav-link">
          <PieChart size={20} />
          Profit & Loss
        </Link>
        <Link to="/orders" className="nav-link">
          <Clock size={20} />
          Orders
        </Link>
        <div className="mobile-only" style={{ height: '1px', background: 'rgba(255,255,255,0.1)', width: '80%' }}></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <span style={{ fontWeight: '500' }}>Hello, {user}</span>
          <button className="btn btn-danger" onClick={handleLogout} style={{ padding: '6px 16px', fontSize: '0.875rem' }}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
