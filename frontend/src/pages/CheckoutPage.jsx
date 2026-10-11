import React, { useState, useEffect } from 'react';
import { catalogApi } from '../api/catalogApi';
import { invoiceApi } from '../api/invoiceApi';
import NetworkSelector from '../components/NetworkSelector';
import InvoiceCard from '../components/InvoiceCard';

export default function CheckoutPage({ onInvoiceCreated, onShowToast }) {
  // Lists from backend
  const [networks, setNetworks] = useState([]);
  const [currencies, setCurrencies] = useState([]);

  // Selected values
  const [selectedNetworkId, setSelectedNetworkId] = useState('');
  const [selectedCurrencyId, setSelectedCurrencyId] = useState('');
  const [amountUSD, setAmountUSD] = useState('10.00');
  const [telegramUser, setTelegramUser] = useState('');
  const [orderId, setOrderId] = useState('WALLEX-ORD-101');
  const [callbackUrl, setCallbackUrl] = useState('https://exchange.wallex.ir/api/webhook');

  // Loading & active invoice
  const [activeInvoice, setActiveInvoice] = useState(null);
  const [loadingNetworks, setLoadingNetworks] = useState(true);
  const [loadingCurrencies, setLoadingCurrencies] = useState(false);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

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
          // شبکه اول را به صورت پیش‌فرض انتخاب نمی‌کنیم تا کاربر خود دراپ‌داون را باز کند
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

  // 2. دریافت ارزهای شبکه انتخاب شده (فعال‌سازی دراپ‌داون دوم)
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

    let rate = 1.0;
    if (selectedCurrency.symbol === 'TON') rate = 5.20;
    else if (selectedCurrency.symbol === 'BNB') rate = 610.0;
    else if (selectedCurrency.symbol === 'USDT') rate = 1.0;

    const crypto = (val / rate).toFixed(selectedCurrency.symbol.includes('USDT') ? 2 : 6);
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

    try {
      setCreatingInvoice(true);
      setErrorMsg('');

      const cleanUser = telegramUser.trim();
      const isNumeric = /^\d+$/.test(cleanUser);

      const invoiceData = await invoiceApi.createInvoice({
        amountUSD: numAmount,
        currencyId: selectedCurrencyId,
        networkId: selectedNetworkId,
        telegramId: isNumeric ? parseInt(cleanUser, 10) : undefined,
        username: cleanUser ? cleanUser : undefined,
        order_id: orderId.trim() || undefined,
        callback_url: callbackUrl.trim() || undefined
      });

      const fullInvoice = {
        ...invoiceData,
        currency_symbol: selectedCurrency?.symbol,
        network_name: selectedNetwork?.name
      };

      setActiveInvoice(fullInvoice);
      onInvoiceCreated?.(fullInvoice);
      onShowToast?.('فاکتور جدید در دیتابیس صادر شد! ⚡', 'success');
    } catch (err) {
      setErrorMsg(err.message || 'خطا در ایجاد فاکتور');
      onShowToast?.(err.message, 'error');
    } finally {
      setCreatingInvoice(false);
    }
  };

  const handleCopy = (text, label) => {
    navigator.clipboard.writeText(text);
    onShowToast?.(`${label} کپی شد! ✅`, 'success');
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
      {/* فرم پرداخت: ابتدا شبکه و کارنسی، سپس مبلغ دلاری */}
      <div className="card-panel">
        <div className="card-title-wrap">
          <div className="card-step-num">⚡</div>
          <h2 className="card-title">درگاه پرداخت و ایجاد فاکتور</h2>
        </div>

        {errorMsg && (
          <div
            style={{
              padding: '0.75rem',
              background: 'rgba(244, 63, 94, 0.15)',
              border: '1px solid var(--rose)',
              borderRadius: '8px',
              fontSize: '0.85rem',
              color: '#fda4af',
              marginBottom: '1.25rem'
            }}
          >
            ⚠️ {errorMsg}
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

        {/* ۲. ورود مبلغ پرداختی به دلار (جایگزین انتخاب خدمت) */}
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
                  background: amountUSD === preset ? 'rgba(6, 182, 212, 0.2)' : undefined,
                  borderColor: amountUSD === preset ? 'var(--cyan)' : undefined
                }}
                onClick={() => setAmountUSD(preset)}
              >
                ${preset}
              </button>
            ))}
          </div>

          {/* تخمین کریپتو */}
          {getEstimatedCrypto() && (
            <div
              style={{
                marginTop: '0.6rem',
                fontSize: '0.86rem',
                color: 'var(--cyan-glow)',
                direction: 'ltr',
                textAlign: 'left'
              }}
            >
              💡 معادل تقریبی: <strong>{getEstimatedCrypto()}</strong>
            </div>
          )}
        </div>

        {/* ۴. آی دی تلگرام کاربر */}
        <div className="selector-group" style={{ marginTop: '1.25rem' }}>
          <label className="selector-label">
            ۴. شناسه کاربری / تلگرام:
          </label>
          <input
            type="text"
            className="input-custom"
            placeholder="مثال: babasoroush یا 987654321"
            value={telegramUser}
            onChange={(e) => setTelegramUser(e.target.value)}
            style={{ direction: 'ltr' }}
          />
        </div>

        {/* ۵. شناسه سفارش سیستم و آدرس وب‌هوک (تنظیمات تکمیلی) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginTop: '1.25rem' }}>
          <div>
            <label className="selector-label">شناسه سفارش (order_id):</label>
            <input
              type="text"
              className="input-custom"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              style={{ direction: 'ltr', fontSize: '0.85rem' }}
            />
          </div>
          <div>
            <label className="selector-label">آدرس وب‌هوک (callback_url):</label>
            <input
              type="text"
              className="input-custom"
              value={callbackUrl}
              onChange={(e) => setCallbackUrl(e.target.value)}
              style={{ direction: 'ltr', fontSize: '0.82rem' }}
            />
          </div>
        </div>

        {/* دکمه ارسال */}
        <button
          type="button"
          className="btn-submit"
          style={{ marginTop: '1.5rem' }}
          onClick={handleCreateInvoice}
          disabled={creatingInvoice || !selectedNetworkId || !selectedCurrencyId || !amountUSD}
        >
          {creatingInvoice ? 'در حال صدور فاکتور در دیتابیس...' : '⚡ صدور فاکتور رسمی (POST /invoices)'}
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
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🧾</div>
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
