import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './Navbar';
import Portfolio from './Portfolio';
import Trade from './Trade';
import HotStocks from './HotStocks';
import ProfitLoss from './ProfitLoss';
import Orders from './Orders';
import Strategy from './Strategy';
import Login from './Login';
import './index.css';

// Protected Route Component
const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" />;
};

export default function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route 
          path="/" 
          element={
            <PrivateRoute>
              <Portfolio />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/trade" 
          element={
            <PrivateRoute>
              <Trade />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/hot-stocks" 
          element={
            <PrivateRoute>
              <HotStocks />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/strategy" 
          element={
            <PrivateRoute>
              <Strategy />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/profit-loss" 
          element={
            <PrivateRoute>
              <ProfitLoss />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/orders" 
          element={
            <PrivateRoute>
              <Orders />
            </PrivateRoute>
          } 
        />
      </Routes>
    </Router>
  );
}
