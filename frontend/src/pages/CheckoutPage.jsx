import React, { useState, useEffect } from 'react';
import { catalogApi } from '../api/catalogApi';
import { invoiceApi } from '../api/invoiceApi';
import NetworkSelector from '../components/NetworkSelector';
import InvoiceCard from '../components/InvoiceCard';
import { CreditCard, AlertTriangle, Calculator, Send, Receipt, Loader2 } from 'lucide-react';

export default function CheckoutPage({ onInvoiceCreated, onShowToast }) {
  // Lists from backend
  const [networks, setNetworks] = useState([]);
  const [currencies, setCurrencies] = useState([]);

  // Selected values
  const [selectedNetworkId, setSelectedNetworkId] = useState('');
  const [selectedCurrencyId, setSelectedCurrencyId] = useState('');
  const [amountUSD, setAmountUSD] = useState('10.00');
  const [telegramUser, setTelegramUser] = useState('');

  // Loading & active invoice
  const [activeInvoice, setActiveInvoice] = useState(null);
  const [loadingNetworks, setLoadingNetworks] = useState(true);
  const [loadingCurrencies, setLoadingCurrencies] = useState(false);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [liveRates, setLiveRates] = useState({});

  // استعلام نرخ‌های زنده لحظه‌ای از والکس (Wallex Live Market API)
  useEffect(() => {
    let isMounted = true;
    const fetchRates = async () => {
      try {
        const res = await invoiceApi.getRates();
        const data = res?.data || res;
        if (isMounted && data && typeof data === 'object') {
          setLiveRates(data);
        }
      } catch (err) {
        console.warn('Could not fetch live Wallex rates:', err);
      }
    };
    fetchRates();
    const interval = setInterval(fetchRates, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // 1. دریافت لیست شبکه‌های بلاکچین از بک‌اند Go
  useEffect(() => {
    let isMounted = true;
    const loadNetworks = async () => {
      try {
        setLoadingNetworks(true);
        const data = await catalogApi.getNetworks();
        if (!isMounted) return;

        if (Array.isArray(data) && data.length > 0) {
          setNetworks(data);
        }
      } catch (err) {
        if (isMounted) {
          setErrorMsg('خطا در دریافت لیست شبکه‌ها: ' + err.message);
        }
      } finally {
        if (isMounted) setLoadingNetworks(false);
      }
    };

    loadNetworks();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. دریافت ارزهای شبکه انتخاب شده
  const handleNetworkChange = async (networkId) => {
    setSelectedNetworkId(networkId);
    setSelectedCurrencyId('');
    setCurrencies([]);

    if (!networkId) return;

    try {
      setLoadingCurrencies(true);
      const currData = await catalogApi.getCurrencies(networkId);
      if (Array.isArray(currData)) {
        setCurrencies(currData);
        if (currData.length === 1) {
          setSelectedCurrencyId(currData[0].id);
        }
      }
    } catch (err) {
      onShowToast?.(`خطا در دریافت ارزهای شبکه: ${err.message}`, 'error');
    } finally {
      setLoadingCurrencies(false);
    }
  };

  // محاسبه تخمینی کریپتو بر اساس نرخ روز
  const selectedCurrency = currencies.find((c) => c.id === selectedCurrencyId);
  const selectedNetwork = networks.find((n) => n.id === selectedNetworkId);

  const getEstimatedCrypto = () => {
    const val = parseFloat(amountUSD);
    if (isNaN(val) || val <= 0 || !selectedCurrency) return null;

    const sym = selectedCurrency.symbol?.toUpperCase();
    let rate = liveRates[sym] || (sym === 'GRAM' ? 1.39 : sym === 'BNB' ? 745.0 : 1.0);

    const crypto = (val / rate).toFixed(sym.includes('USDT') ? 2 : 6);
    return `${crypto} ${selectedCurrency.symbol}`;
  };

  // صدور فاکتور رسمی
  const handleCreateInvoice = async () => {
    const numAmount = parseFloat(amountUSD);
    if (!selectedNetworkId) {
      onShowToast?.('لطفاً ابتدا شبکه بلاکچین را انتخاب کنید', 'error');
      return;
    }
    if (!selectedCurrencyId) {
      onShowToast?.('لطفاً ارز پرداختی را انتخاب کنید', 'error');
      return;
    }
    if (isNaN(numAmount) || numAmount <= 0) {
      onShowToast?.('لطفاً مبلغ معتبری به دلار وارد کنید', 'error');
      return;
    }

    const cleanUser = telegramUser.trim();
    if (!cleanUser) {
      setErrorMsg('وارد کردن شناسه یا نام کاربری تلگرام ضروری است.');
      return;
    }

    try {
      setCreatingInvoice(true);
      setErrorMsg('');

      const isNumeric = /^\d+$/.test(cleanUser);

      const invoiceData = await invoiceApi.createInvoice({
        amountUSD: numAmount,
        currencyId: selectedCurrencyId,
        networkId: selectedNetworkId,
        telegramId: isNumeric ? parseInt(cleanUser, 10) : undefined,
        username: cleanUser ? cleanUser : undefined
      });

      const fullInvoice = {
        ...invoiceData,
        currency_symbol: selectedCurrency?.symbol,
        network_name: selectedNetwork?.name
      };

      setActiveInvoice(fullInvoice);
      onInvoiceCreated?.(fullInvoice);
      onShowToast?.('فاکتور جدید در دیتابیس صادر شد', 'success');
    } catch (err) {
      setErrorMsg(err.message || 'خطا در ایجاد فاکتور');
      onShowToast?.(err.message, 'error');
    } finally {
      setCreatingInvoice(false);
    }
  };

  const handleCopy = (text, label) => {
    navigator.clipboard.writeText(text);
    onShowToast?.(`${label} کپی شد`, 'success');
  };

  const handleStatusChange = (newStatus, updatedData) => {
    if (activeInvoice) {
      setActiveInvoice((prev) => ({
        ...prev,
        status: newStatus,
        ...(updatedData || {})
      }));
    }
  };

  return (
    <div className="checkout-grid">
      {/* فرم پرداخت */}
      <div className="card-panel">
        <div className="card-title-wrap">
          <div className="card-step-num">
            <CreditCard size={16} />
          </div>
          <h2 className="card-title">درگاه پرداخت و ایجاد فاکتور</h2>
        </div>

        {errorMsg && (
          <div
            style={{
              padding: '0.75rem',
              background: 'var(--rose-subtle)',
              border: '1px solid var(--rose)',
              borderRadius: '8px',
              fontSize: '0.85rem',
              color: '#fda4af',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <AlertTriangle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ۱. انتخاب شبکه و دراپ‌داون وابسته کارنسی */}
        <NetworkSelector
          networks={networks}
          selectedNetworkId={selectedNetworkId}
          onChangeNetwork={handleNetworkChange}
          currencies={currencies}
          selectedCurrencyId={selectedCurrencyId}
          onChangeCurrency={setSelectedCurrencyId}
          loadingNetworks={loadingNetworks}
          loadingCurrencies={loadingCurrencies}
        />

        {/* ۲. ورود مبلغ پرداختی به دلار */}
        <div className="selector-group" style={{ marginTop: '1.5rem' }}>
          <label className="selector-label">
            ۳. مبلغ پرداختی به دلار آمریکا (USD Amount):
          </label>
          <input
            type="number"
            step="0.01"
            min="0.1"
            className="input-custom"
            style={{ fontSize: '1.1rem', fontWeight: 800, direction: 'ltr' }}
            value={amountUSD}
            onChange={(e) => setAmountUSD(e.target.value)}
            placeholder="مثال: 10.00"
          />

          {/* کلیدهای سریع انتخاب مبلغ */}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
            {['5.00', '10.00', '25.00', '50.00', '100.00'].map((preset) => (
              <button
                key={preset}
                type="button"
                className="btn-sim-action"
                style={{
                  background: amountUSD === preset ? 'rgba(37, 99, 235, 0.2)' : undefined,
                  borderColor: amountUSD === preset ? 'var(--primary)' : undefined
                }}
                onClick={() => setAmountUSD(preset)}
              >
                ${preset}
              </button>
            ))}
          </div>

          {/* تخمین کریپتو بر اساس نرخ زنده والکس */}
          {getEstimatedCrypto() && (
            <div
              style={{
                marginTop: '0.65rem',
                fontSize: '0.86rem',
                color: '#93c5fd',
                direction: 'rtl',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.5rem'
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <Calculator size={14} />
                معادل تقریبی: <strong style={{ direction: 'ltr', display: 'inline-block', color: '#fff' }}>{getEstimatedCrypto()}</strong>
              </span>
              <span
                style={{
                  fontSize: '0.72rem',
                  color: '#93c5fd',
                  background: '#172554',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  border: '1px solid #1e3a8a'
                }}
              >
                استعلام زنده از والکس (Wallex)
              </span>
            </div>
          )}
        </div>

        {/* ۳. آی دی تلگرام کاربر */}
        <div className="selector-group" style={{ marginTop: '1.25rem' }}>
          <label className="selector-label">
            ۴. شناسه کاربری / تلگرام:
          </label>
          <input
            type="text"
            className="input-custom"
            value={telegramUser}
            onChange={(e) => {
              setTelegramUser(e.target.value);
              if (errorMsg) setErrorMsg('');
            }}
            placeholder="@username یا شناسه عددی"
            style={{ direction: 'ltr' }}
          />
        </div>

        {/* دکمه صدور فاکتور */}
        <button
          type="button"
          className="btn-submit"
          style={{ marginTop: '1.5rem', fontWeight: 700 }}
          onClick={handleCreateInvoice}
          disabled={creatingInvoice || !selectedNetworkId || !selectedCurrencyId || !amountUSD}
        >
          {creatingInvoice ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              در حال صدور فاکتور در دیتابیس...
            </>
          ) : (
            <>
              <Send size={16} />
              صدور فاکتور پرداخت (Generate Invoice)
            </>
          )}
        </button>
      </div>

      {/* ستون نمایش فاکتور صادر شده */}
      <div>
        {activeInvoice ? (
          <InvoiceCard
            invoice={activeInvoice}
            onStatusChange={handleStatusChange}
            onCopy={handleCopy}
            onReset={() => setActiveInvoice(null)}
          />
        ) : (
          <div className="card-panel" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
            <Receipt size={44} style={{ color: 'var(--text-dim)', margin: '0 auto 1rem' }} />
            <h3 style={{ fontSize: '1.2rem', color: '#fff', marginBottom: '0.5rem' }}>فاکتوری صادر نشده است</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '380px', margin: '0 auto' }}>
              ابتدا شبکه و ارز بلاکچین را از دراپ‌داون انتخاب کرده، مبلغ دلاری مورد نظر را وارد نمایید و روی دکمه صدور فاکتور کلیک کنید.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
