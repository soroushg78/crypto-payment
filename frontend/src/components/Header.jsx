import React, { useState, useEffect } from 'react';
import { healthApi } from '../api/healthApi';
import { useAuth } from '../context/AuthContext';
import {
  Zap,
  CheckCircle2,
  AlertCircle,
  Loader2,
  User,
  CreditCard,
  Landmark,
  BarChart3,
  FileText,
  LogOut
} from 'lucide-react';

export default function Header({ activeTab, setActiveTab, historyCount = 0, rebalanceCount = 0 }) {
  const { user, logout } = useAuth();
  const [isHealthy, setIsHealthy] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const check = async () => {
      try {
        await healthApi.checkHealth();
        if (isMounted) setIsHealthy(true);
      } catch {
        if (isMounted) setIsHealthy(false);
      }
    };

    check();
    const interval = setInterval(check, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div>
      <header className="app-header">
        <div className="brand-section">
          <div className="brand-icon-box">
            <Zap size={22} />
          </div>
          <div>
            <h1 className="brand-title">درگاه پرداخت کریپتو و مدیریت خزانه‌داری</h1>
          </div>
        </div>

        <div className="header-controls">
          <div
            className={`mode-badge ${isHealthy ? 'mode-live' : 'mode-mock'}`}
            title="وضعیت اتصال به سرور Go"
          >
            <div className="pulse-dot"></div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              {isHealthy === true && (
                <>
                  <CheckCircle2 size={14} />
                  بک‌اند متصل و فعال
                </>
              )}
              {isHealthy === false && (
                <>
                  <AlertCircle size={14} />
                  خطا در اتصال به بک‌اند
                </>
              )}
              {isHealthy === null && (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  در حال بررسی اتصال...
                </>
              )}
            </span>
          </div>

          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <User size={14} />
                {user.username}
              </span>
              <button
                className="btn-sim-action"
                style={{ borderColor: 'rgba(244, 63, 94, 0.4)', color: '#fb7185' }}
                onClick={logout}
                title="خروج از حساب"
              >
                <LogOut size={13} />
                خروج
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="view-tabs" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          className={`tab-btn ${activeTab === 'checkout' ? 'active' : ''}`}
          onClick={() => setActiveTab('checkout')}
        >
          <CreditCard size={16} />
          درگاه پرداخت و صدور فاکتور
        </button>
        <button
          className={`tab-btn ${activeTab === 'rebalance' ? 'active' : ''}`}
          onClick={() => setActiveTab('rebalance')}
        >
          <Landmark size={16} />
          خزانه‌داری و ریبالانسینگ
        </button>
        <button
          className={`tab-btn ${activeTab === 'rebalance-records' ? 'active' : ''}`}
          onClick={() => setActiveTab('rebalance-records')}
        >
          <BarChart3 size={16} />
          سوابق ریبالانسینگ ({rebalanceCount})
        </button>
        <button
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <FileText size={16} />
          سوابق سفارشات و تراکنش‌ها ({historyCount})
        </button>
      </div>
    </div>
  );
}
