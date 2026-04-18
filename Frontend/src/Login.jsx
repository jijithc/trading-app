import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import API_BASE_URL from './apiConfig';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ username: '', password: '', brokerApiKey: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      if (isLogin) {
        const res = await axios.post(`${API_BASE_URL}/api/auth/login`, {
          username: formData.username,
          password: formData.password
        });
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('username', res.data.username);
        navigate('/');
      } else {
        await axios.post(`${API_BASE_URL}/api/auth/register`, formData);
        setIsLogin(true);
        setError('Registration successful, please login');
      }
    } catch (err) {
      setError(err.response?.data || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100%' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '400px' }}>
        <h2 className="title" style={{ textAlign: 'center', marginBottom: '8px' }}>
          {isLogin ? 'Welcome Back' : 'Create Account'}
        </h2>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '32px' }}>
          {isLogin ? 'Login to manage your portfolio' : 'Join TradeProX today'}
        </p>

        {error && <div style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger)', padding: '12px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center', border: '1px solid var(--danger)' }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username</label>
            <input type="text" className="form-control" name="username" value={formData.username}
                   onChange={e => setFormData({ ...formData, username: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" className="form-control" name="password" value={formData.password}
                   onChange={e => setFormData({ ...formData, password: e.target.value })} required />
          </div>
          
          {!isLogin && (
            <div className="form-group">
              <label>Broker API Key</label>
              <input type="text" className="form-control" name="brokerApiKey" value={formData.brokerApiKey}
                     onChange={e => setFormData({ ...formData, brokerApiKey: e.target.value })} required />
            </div>
          )}

          <button 
            className="btn btn-success" 
            style={{ width: '100%', marginTop: '20px', padding: '12px', fontSize: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
            disabled={isLoading}
          >
            {isLoading ? 
              <>
                <div style={{ width: '16px', height: '16px', border: '2px solid white', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                {isLogin ? 'Signing In...' : 'Registering...'}
              </>
              : (isLogin ? 'Sign In' : 'Register')
            }
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '24px', color: 'var(--text-secondary)' }}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <span 
            style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: '500' }} 
            onClick={() => setIsLogin(!isLogin)}
          >
            {isLogin ? 'Register now' : 'Login'}
          </span>
        </p>
      </div>
    </div>
  );
}
