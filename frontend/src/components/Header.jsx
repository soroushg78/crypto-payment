import React, { useState, useEffect } from 'react';
import { healthApi } from '../api/healthApi';
import { useAuth } from '../context/AuthContext';

export default function Header({ activeTab, setActiveTab, historyCount = 0 }) {
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
          <div className="brand-icon-box">⚡</div>
          <div>
            <h1 className="brand-title">درگاه پرداخت کریپتو و ناظر بلاکچین</h1>
            <div className="brand-sub">محیط واقعی تست و اعتبارسنجی فاکتورها | Go Backend + PostgreSQL</div>
          </div>
        </div>

        <div className="header-controls">
          <div
            className={`mode-badge ${isHealthy ? 'mode-live' : 'mode-mock'}`}
            title="وضعیت اتصال به سرور Go"
          >
            <div className="pulse-dot"></div>
            <span>
              {isHealthy === true && 'بک‌اند متصل و فعال 🟢'}
              {isHealthy === false && 'خطا در اتصال به بک‌اند 🔴'}
              {isHealthy === null && 'در حال بررسی اتصال... ⏳'}
            </span>
          </div>

          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                👤 {user.username}
              </span>
              <button
                className="btn-sim-action"
                style={{ borderColor: 'rgba(244, 63, 94, 0.4)', color: '#fb7185' }}
                onClick={logout}
                title="خروج از حساب"
              >
                خروج
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="view-tabs">
        <button
          className={`tab-btn ${activeTab === 'checkout' ? 'active' : ''}`}
          onClick={() => setActiveTab('checkout')}
        >
          💳 صدور و پرداخت فاکتور
        </button>
        <button
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          📜 سوابق سفارشات ({historyCount})
        </button>
      </div>
    </div>
  );
}
