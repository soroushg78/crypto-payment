import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Header from './components/Header';
import Toast from './components/Toast';
import LoginPage from './pages/LoginPage';
import CheckoutPage from './pages/CheckoutPage';
import HistoryPage from './pages/HistoryPage';

function MainApp() {
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('checkout');
  const [toast, setToast] = useState({ message: '', type: 'info' });

  const [history, setHistory] = useState(() => {
    try {
      const stored = localStorage.getItem('crypto_invoice_history_v2');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: '', type: 'info' }), 3000);
  };

  const handleInvoiceCreated = (newInv) => {
    const updated = [newInv, ...history.slice(0, 29)];
    setHistory(updated);
    try {
      localStorage.setItem('crypto_invoice_history_v2', JSON.stringify(updated));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem('crypto_invoice_history_v2');
    showToast('سوابق فاکتورها پاک شد.', 'info');
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
        historyCount={history.length}
      />

      <main style={{ marginTop: '1.5rem' }}>
        {activeTab === 'checkout' ? (
          <CheckoutPage
            onInvoiceCreated={handleInvoiceCreated}
            onShowToast={showToast}
          />
        ) : (
          <HistoryPage
            history={history}
            onClear={handleClearHistory}
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
