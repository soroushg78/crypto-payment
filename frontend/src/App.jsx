import React, { useState, useEffect } from 'react';

// Default catalog fallback data matching the Go backend seeds
const DEFAULT_SERVICES = [
  { id: 'srv-vip-1m', code: 'VIP_1M', title: 'اشتراک ۱ ماهه کانال VIP', description: 'دسترسی کامل به سیگنال‌ها و آموزش‌های اختصاصی', price_usd: 5.0 },
  { id: 'srv-vip-3m', code: 'VIP_3M', title: 'اشتراک ۳ ماهه کانال VIP (تخفیف ۲۰٪)', description: 'دسترسی ۳ ماهه با پشتیبانی ویژه', price_usd: 12.0 },
  { id: 'srv-topup-25', code: 'TOPUP_25', title: 'شارژ کیف پول داخلی', description: 'افزایش اعتبار حساب برای خریدهای آتی', price_usd: 25.0 }
];

const DEFAULT_NETWORKS = [
  { id: 'ton', name: 'The Open Network (TON)', native_currency: 'TON', is_active: true },
  { id: 'tron', name: 'TRON Blockchain (TRX/TRC20)', native_currency: 'TRX', is_active: true }
];

const DEFAULT_CURRENCIES = {
  ton: [
    { id: 'curr-ton', symbol: 'TON', rate: 5.0, decimals: 9 },
    { id: 'curr-usdt-ton', symbol: 'USDT (Jetton)', rate: 1.0, decimals: 6 }
  ],
  tron: [
    { id: 'curr-trx', symbol: 'TRX', rate: 0.15, decimals: 6 },
    { id: 'curr-usdt-trc20', symbol: 'USDT (TRC20)', rate: 1.0, decimals: 6 }
  ]
};

export default function App() {
  const [activeTab, setActiveTab] = useState('checkout'); // 'checkout' | 'history'
  const [apiBaseUrl, setApiBaseUrl] = useState('http://localhost:8080');
  const [isBackendHealthy, setIsBackendHealthy] = useState(null);
  const [useLiveApi, setUseLiveApi] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Selection states
  const [selectedService, setSelectedService] = useState(DEFAULT_SERVICES[0]);
  const [selectedNetwork, setSelectedNetwork] = useState(DEFAULT_NETWORKS[0]);
  const [selectedCurrency, setSelectedCurrency] = useState(DEFAULT_CURRENCIES.ton[0]);
  const [telegramId, setTelegramId] = useState('84920194');

  // Active Invoice state
  const [currentInvoice, setCurrentInvoice] = useState(null);
  const [timeLeft, setTimeLeft] = useState(1800); // 30 minutes in seconds
  const [loading, setLoading] = useState(false);

  // History state
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('crypto_invoice_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Check backend health on mount and every 15s
  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, [apiBaseUrl]);

  const checkHealth = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/health`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        setIsBackendHealthy(true);
        setUseLiveApi(true);
      } else {
        setIsBackendHealthy(false);
      }
    } catch {
      setIsBackendHealthy(false);
    }
  };

  // Switch available currencies when network changes
  const handleNetworkChange = (network) => {
    setSelectedNetwork(network);
    const available = DEFAULT_CURRENCIES[network.id] || DEFAULT_CURRENCIES.ton;
    setSelectedCurrency(available[0]);
  };

  // Toast Helper
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // Copy to clipboard
  const copyText = (text, label) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} کپی شد! ✅`);
  };

  // 30-minute Timer countdown for active invoice
  useEffect(() => {
    if (!currentInvoice || currentInvoice.status !== 'PENDING') return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          updateInvoiceStatus('EXPIRED');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentInvoice]);

  // Create Invoice handler
  const handleCreateInvoice = async () => {
    setLoading(true);

    const priceUSD = selectedService.price_usd;
    const rate = selectedCurrency.rate || 1.0;
    const cryptoAmount = (priceUSD / rate).toFixed(selectedCurrency.symbol.includes('USDT') ? 2 : 6);
    const memo = 'ORD-' + Math.floor(10000 + Math.random() * 90000);
    const invoiceNumber = 'INV-' + Date.now().toString().slice(-6);

    let newInvoice = {
      id: 'inv-' + Math.random().toString(36).substring(2, 9),
      invoice_number: invoiceNumber,
      service_title: selectedService.title,
      amount_usd: priceUSD,
      crypto_amount: cryptoAmount,
      currency_symbol: selectedCurrency.symbol,
      network_name: selectedNetwork.name,
      network_id: selectedNetwork.id,
      pay_address:
        selectedNetwork.id === 'ton'
          ? 'EQBvW8Z5huBkMJYdnfAEM5JqTN1SR59mZ7W2VjN2_Treasury'
          : 'TYDzsYUEpvnYmQK4zGPj29sdgyFvP4k67x',
      pay_memo: memo,
      status: 'PENDING',
      created_at: new Date().toLocaleTimeString('fa-IR'),
      telegram_id: telegramId
    };

    // Attempt live API if connected
    if (useLiveApi && isBackendHealthy) {
      try {
        const payload = {
          service_id: selectedService.id,
          currency_id: selectedCurrency.id,
          network_id: selectedNetwork.id,
          telegram_id: telegramId ? parseInt(telegramId, 10) : null
        };
        const res = await fetch(`${apiBaseUrl}/api/v1/invoices`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            newInvoice = {
              ...newInvoice,
              id: json.data.id || newInvoice.id,
              invoice_number: json.data.invoice_number || newInvoice.invoice_number,
              pay_address: json.data.pay_address || newInvoice.pay_address,
              pay_memo: json.data.pay_memo || newInvoice.pay_memo
            };
          }
        }
      } catch (err) {
        console.warn('API call failed, falling back to instant local mock:', err);
      }
    }

    setCurrentInvoice(newInvoice);
    setTimeLeft(1800);
    setLoading(false);

    // Save to history
    const updatedHistory = [newInvoice, ...history.slice(0, 19)];
    setHistory(updatedHistory);
    localStorage.setItem('crypto_invoice_history', JSON.stringify(updatedHistory));
    showToast('فاکتور با موفقیت صادر شد! ⚡');
  };

  // Update status (local and history)
  const updateInvoiceStatus = (newStatus) => {
    if (!currentInvoice) return;
    const updated = { ...currentInvoice, status: newStatus };
    setCurrentInvoice(updated);

    const updatedHistory = history.map((item) =>
      item.id === currentInvoice.id ? { ...item, status: newStatus } : item
    );
    setHistory(updatedHistory);
    localStorage.setItem('crypto_invoice_history', JSON.stringify(updatedHistory));
  };

  // Format MM:SS
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="app-container">
      {/* Toast */}
      {toastMessage && <div className="toast-msg">{toastMessage}</div>}

      {/* Header */}
      <header className="app-header">
        <div className="brand-section">
          <div className="brand-icon-box">⚡</div>
          <div>
            <h1 className="brand-title">درگاه پرداخت کریپتو و ناظر بلاکچین</h1>
            <div className="brand-sub">React Test & Demo Interface | Go Clean Architecture</div>
          </div>
        </div>

        <div className="header-controls">
          <div
            className={`mode-badge ${isBackendHealthy ? 'mode-live' : 'mode-mock'}`}
            onClick={() => setUseLiveApi(!useLiveApi)}
            title="کلیک برای تغییر حالت تست"
          >
            <div className="pulse-dot"></div>
            <span>
              {isBackendHealthy
                ? useLiveApi
                  ? 'متصل به بک‌اند Go (پورت ۸۰۸۰) 🟢'
                  : 'حالت دمو لوکال (سریع) 🟡'
                : 'سرور Go آفلاین (حالت دمو فعال) 🟡'}
            </span>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="view-tabs">
        <button
          className={`tab-btn ${activeTab === 'checkout' ? 'active' : ''}`}
          onClick={() => setActiveTab('checkout')}
        >
          🛒 صدور و پرداخت فاکتور
        </button>
        <button
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          📜 سوابق سفارشات ({history.length})
        </button>
      </div>

      {activeTab === 'checkout' ? (
        <div className="checkout-grid">
          {/* Step 1 & 2: Plan Selection */}
          <div className="card-panel">
            <div className="card-title-wrap">
              <div className="card-step-num">۱</div>
              <h2 className="card-title">انتخاب خدمت یا پلن</h2>
            </div>

            <div className="options-list">
              {DEFAULT_SERVICES.map((srv) => (
                <div
                  key={srv.id}
                  className={`plan-item ${selectedService.id === srv.id ? 'selected' : ''}`}
                  onClick={() => setSelectedService(srv)}
                >
                  <div className="plan-info">
                    <h4>{srv.title}</h4>
                    <p>{srv.description}</p>
                  </div>
                  <div className="plan-price">${srv.price_usd.toFixed(2)}</div>
                </div>
              ))}
            </div>

            <div className="card-title-wrap" style={{ marginTop: '1.8rem' }}>
              <div className="card-step-num">۲</div>
              <h2 className="card-title">انتخاب شبکه و ارز پرداختی</h2>
            </div>

            <div className="selector-group">
              <label className="selector-label">شبکه بلاکچین (Blockchain Network):</label>
              <div className="pill-grid">
                {DEFAULT_NETWORKS.map((net) => (
                  <button
                    key={net.id}
                    className={`pill-btn ${selectedNetwork.id === net.id ? 'selected' : ''}`}
                    onClick={() => handleNetworkChange(net)}
                  >
                    {net.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="selector-group">
              <label className="selector-label">کوین یا توکن (Currency):</label>
              <div className="pill-grid">
                {(DEFAULT_CURRENCIES[selectedNetwork.id] || DEFAULT_CURRENCIES.ton).map((curr) => (
                  <button
                    key={curr.id}
                    className={`pill-btn ${selectedCurrency.id === curr.id ? 'selected' : ''}`}
                    onClick={() => setSelectedCurrency(curr)}
                  >
                    {curr.symbol}
                  </button>
                ))}
              </div>
            </div>

            <div className="selector-group">
              <label className="selector-label">شناسه کاربری تلگرام (Telegram ID):</label>
              <input
                type="text"
                className="input-custom"
                value={telegramId}
                onChange={(e) => setTelegramId(e.target.value)}
                placeholder="مثال: 84920194"
              />
            </div>

            <button
              className="btn-submit"
              onClick={handleCreateInvoice}
              disabled={loading}
            >
              {loading ? 'در حال صدور فاکتور...' : '⚡ صدور فاکتور پرداخت (Invoice)'}
            </button>
          </div>

          {/* Invoice Display Column */}
          <div>
            {currentInvoice ? (
              <div className="invoice-card">
                <div className="inv-status-header">
                  <div className={`inv-status-badge status-${currentInvoice.status}`}>
                    {currentInvoice.status === 'PENDING' && 'در انتظار پرداخت ⏳'}
                    {currentInvoice.status === 'PAID' && 'پرداخت موفق و تایید شده ✅'}
                    {currentInvoice.status === 'UNDERPAID' && 'کسری واریزی ⚠️'}
                    {currentInvoice.status === 'EXPIRED' && 'فاکتور منقضی شده ⌛'}
                  </div>
                  {currentInvoice.status === 'PENDING' && (
                    <div className="timer-box">⏱ {formatTime(timeLeft)}</div>
                  )}
                </div>

                <div className="amount-hero">
                  <div className="amount-crypto">
                    {currentInvoice.crypto_amount} {currentInvoice.currency_symbol}
                  </div>
                  <div className="amount-usd">
                    معادل ${currentInvoice.amount_usd.toFixed(2)} USD در شبکه {currentInvoice.network_name}
                  </div>
                </div>

                <div className="info-rows">
                  <div className="info-row">
                    <span className="label">شماره فاکتور:</span>
                    <span className="val">{currentInvoice.invoice_number}</span>
                  </div>

                  <div className="info-row">
                    <span className="label">آدرس واریز والت:</span>
                    <span className="val">
                      {currentInvoice.pay_address.slice(0, 10)}...{currentInvoice.pay_address.slice(-6)}
                      <button
                        className="copy-icon-btn"
                        onClick={() => copyText(currentInvoice.pay_address, 'آدرس کیف پول')}
                      >
                        کپی
                      </button>
                    </span>
                  </div>

                  <div className="info-row">
                    <span className="label">کامنت / ممو (Comment / Memo):</span>
                    <span className="val" style={{ color: '#fbbf24', fontWeight: 800 }}>
                      {currentInvoice.pay_memo}
                      <button
                        className="copy-icon-btn"
                        onClick={() => copyText(currentInvoice.pay_memo, 'ممو (Memo)')}
                      >
                        کپی
                      </button>
                    </span>
                  </div>
                </div>

                <div className="memo-alert">
                  ⚠️ <strong>توجه بسیار مهم:</strong> هنگام ارسال وجه از کیف‌پول، حتماً مقدار <strong>Memo</strong> را در بخش Comment/Note وارد کنید؛ در غیر این صورت فاکتور به شکل خودکار شارژ نمی‌شود.
                </div>

                {/* QR Code and Direct Link */}
                <div className="qr-section">
                  <svg className="qr-box" viewBox="0 0 100 100">
                    <rect width="100" height="100" fill="#ffffff" />
                    <rect x="5" y="5" width="26" height="26" fill="#000000" />
                    <rect x="9" y="9" width="18" height="18" fill="#ffffff" />
                    <rect x="13" y="13" width="10" height="10" fill="#000000" />
                    <rect x="69" y="5" width="26" height="26" fill="#000000" />
                    <rect x="73" y="9" width="18" height="18" fill="#ffffff" />
                    <rect x="77" y="13" width="10" height="10" fill="#000000" />
                    <rect x="5" y="69" width="26" height="26" fill="#000000" />
                    <rect x="9" y="73" width="18" height="18" fill="#ffffff" />
                    <rect x="13" y="77" width="10" height="10" fill="#000000" />
                    <rect x="38" y="10" width="8" height="8" fill="#000000" />
                    <rect x="36" y="36" width="28" height="28" fill="#06b6d4" />
                    <rect x="42" y="42" width="16" height="16" fill="#ffffff" />
                    <rect x="46" y="46" width="8" height="8" fill="#6366f1" />
                    <rect x="60" y="70" width="25" height="18" fill="#000000" />
                  </svg>
                  <div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#fff' }}>اسکن سریع در ولت</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>سازگار با Tonkeeper و تلگرام ولت</div>
                    <a
                      href={`ton://transfer/${currentInvoice.pay_address}?amount=${Math.round(currentInvoice.crypto_amount * 1e9)}&text=${currentInvoice.pay_memo}`}
                      className="wallet-direct-btn"
                      onClick={(e) => {
                        e.preventDefault();
                        showToast('لینک دیپ‌لینک Tonkeeper باز شد!');
                      }}
                    >
                      🔗 باز کردن مستقیم در Tonkeeper
                    </a>
                  </div>
                </div>

                {/* Celebration Card when Paid */}
                {currentInvoice.status === 'PAID' && (
                  <div className="celebrate-card">
                    <div className="celebrate-icon">🎉</div>
                    <h3 style={{ color: '#34d399', marginBottom: '0.3rem' }}>پرداخت با موفقیت تایید شد!</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      تراکنش روی نود بلاکچین ثبت و اشتراک اکانت فعال گردید.
                    </p>
                  </div>
                )}

                {/* Payment Simulation Controls Bar */}
                <div className="sim-controls-bar">
                  <div className="sim-bar-title">پنل شبیه‌سازی تراکنش بلاکچین (تست دمو):</div>
                  <div className="sim-buttons-flex">
                    <button
                      className="btn-sim-action btn-sim-success"
                      onClick={() => {
                        updateInvoiceStatus('PAID');
                        showToast('تراکنش با موفقیت شبیه‌سازی شد! (PAID) ✅');
                      }}
                    >
                      🟢 تایید واریز کامل (PAID)
                    </button>
                    <button
                      className="btn-sim-action"
                      onClick={() => {
                        updateInvoiceStatus('UNDERPAID');
                        showToast('سناریوی کسری واریز اعمال شد! ⚠️');
                      }}
                    >
                      🟡 کسری واریز (Underpaid)
                    </button>
                    <button
                      className="btn-sim-action"
                      onClick={() => {
                        updateInvoiceStatus('EXPIRED');
                        showToast('سناریوی انقضا اعمال شد! ⌛');
                      }}
                    >
                      ⌛ انقضای فاکتور
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card-panel" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🧾</div>
                <h3 style={{ fontSize: '1.2rem', color: '#fff', marginBottom: '0.5rem' }}>فاکتوری صادر نشده است</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '360px', margin: '0 auto' }}>
                  برای شروع تست، از ستون سمت راست یک خدمت و ارز انتخاب کنید و روی «صدور فاکتور پرداخت» کلیک نمایید.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* History View */
        <div className="card-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h2 className="card-title">سوابق فاکتورهای ایجاد شده در محیط تست</h2>
            {history.length > 0 && (
              <button
                className="btn-sim-action"
                onClick={() => {
                  setHistory([]);
                  localStorage.removeItem('crypto_invoice_history');
                  showToast('سوابق پاک شدند.');
                }}
              >
                پاک کردن تاریخچه
              </button>
            )}
          </div>

          {history.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="history-table">
                <thead>
                  <tr>
                    <th>شماره فاکتور</th>
                    <th>خدمت درخواستی</th>
                    <th>مبلغ</th>
                    <th>شبکه</th>
                    <th>Memo</th>
                    <th>وضعیت</th>
                    <th>زمان</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((inv) => (
                    <tr key={inv.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', direction: 'ltr' }}>{inv.invoice_number}</td>
                      <td>{inv.service_title}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan-glow)', direction: 'ltr' }}>
                        {inv.crypto_amount} {inv.currency_symbol}
                      </td>
                      <td>{inv.network_name}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: '#fbbf24' }}>{inv.pay_memo}</td>
                      <td>
                        <span className={`inv-status-badge status-${inv.status}`}>{inv.status}</span>
                      </td>
                      <td style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>{inv.created_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
              هیچ فاکتوری در حافظه ثبت نشده است.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
