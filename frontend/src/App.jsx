import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Header from './components/Header';
import Toast from './components/Toast';
import LoginPage from './pages/LoginPage';
import CheckoutPage from './pages/CheckoutPage';
import HistoryPage from './pages/HistoryPage';
import RebalancePage from './pages/RebalancePage';
import RebalanceHistoryPage from './pages/RebalanceHistoryPage';
import ApiDocsPage from './pages/ApiDocsPage';
import { invoiceApi } from './api/invoiceApi';
import { rebalanceApi } from './api/rebalanceApi';

function MainApp() {
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('checkout');
  const [toast, setToast] = useState({ message: '', type: 'info' });
  const [invoiceCount, setInvoiceCount] = useState(0);
  const [rebalanceCount, setRebalanceCount] = useState(0);

  // دریافت تعداد فاکتورها از دیتابیس به صورت زنده
  const refreshInvoiceCount = async () => {
    try {
      const res = await invoiceApi.listInvoices(100);
      const list = Array.isArray(res) ? res : res?.data || [];
      setInvoiceCount(list.length);
    } catch {
      // چشم‌پوشی از خطا در صورت عدم دسترسی موقت
    }
  };

  // دریافت تعداد رکوردهای ریبالانسینگ BSC از دیتابیس
  const refreshRebalanceCount = async () => {
    try {
      const res = await rebalanceApi.getRebalanceRecords(150);
      const list = Array.isArray(res) ? res : res?.data || [];
      const bscList = list.filter((r) => {
        const net = (r.network_id || r.network || '').toLowerCase();
        return net === 'bsc' || net === '' || net.includes('bep');
      });
      setRebalanceCount(bscList.length);
    } catch {
      // چشم‌پوشی
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      refreshInvoiceCount();
      refreshRebalanceCount();
    }
  }, [isAuthenticated]);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: '', type: 'info' }), 3500);
  };

  const handleInvoiceCreated = () => {
    refreshInvoiceCount();
  };

  // اگر کاربر لاگین نکرده باشد، صفحه لاگین نمایش داده می‌شود
  if (!isAuthenticated) {
    return (
      <div className="app-container">
        <Toast message={toast.message} type={toast.type} />
        <LoginPage />
      </div>
    );
  }

  return (
    <div className="app-container">
      <Toast message={toast.message} type={toast.type} />

      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        historyCount={invoiceCount}
        rebalanceCount={rebalanceCount}
      />

      <main style={{ marginTop: '1.5rem' }}>
        {activeTab === 'checkout' && (
          <CheckoutPage
            onInvoiceCreated={handleInvoiceCreated}
            onShowToast={showToast}
          />
        )}

        {activeTab === 'rebalance' && (
          <RebalancePage
            onShowToast={showToast}
            onNavigateToRecords={() => {
              refreshRebalanceCount();
              setActiveTab('rebalance-records');
            }}
          />
        )}

        {activeTab === 'rebalance-records' && (
          <RebalanceHistoryPage
            onShowToast={showToast}
            onNavigateToRebalance={() => setActiveTab('rebalance')}
          />
        )}

        {activeTab === 'history' && (
          <HistoryPage
            onCountUpdated={(count) => setInvoiceCount(count)}
            onShowToast={showToast}
            onCopy={(text, label) => {
              navigator.clipboard.writeText(text);
              showToast(`${label} کپی شد! ✅`, 'success');
            }}
          />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
