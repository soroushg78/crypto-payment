import React, { useState, useEffect } from 'react';
import { invoiceApi } from '../api/invoiceApi';

export default function InvoiceCard({ invoice, onStatusChange, onCopy, onReset }) {
  const [timeLeft, setTimeLeft] = useState(1800);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // محاسبه زمان انقضای واقعی بر اساس expires_at اگر موجود باشد
  useEffect(() => {
    if (!invoice?.expires_at) {
      setTimeLeft(1800);
      return;
    }

    const expTime = new Date(invoice.expires_at).getTime();
    const updateRemain = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((expTime - now) / 1000));
      setTimeLeft(diff);
      if (diff <= 0 && invoice.status === 'PENDING') {
        onStatusChange?.('EXPIRED');
      }
    };

    updateRemain();
    const timer = setInterval(updateRemain, 1000);
    return () => clearInterval(timer);
  }, [invoice?.expires_at, invoice?.status]);

  // پایش واقعی (Polling) وضعیت فاکتور از بک‌اند هر ۳ ثانیه یکبار تا زمان تسویه
  useEffect(() => {
    if (!invoice?.id || invoice.status !== 'PENDING') return;

    let isSubscribed = true;
    const pollStatus = async () => {
      try {
        const updated = await invoiceApi.getInvoiceById(invoice.id);
        if (isSubscribed && updated && updated.status !== invoice.status) {
          onStatusChange?.(updated.status, updated);
        }
      } catch (err) {
        // نادیده گرفتن خطاهای موقت شبکه در پولینگ
      }
    };

    const interval = setInterval(pollStatus, 3000);
    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [invoice?.id, invoice?.status]);

  // بررسی دستی وضعیت
  const handleManualRefresh = async () => {
    if (!invoice?.id) return;
    setIsRefreshing(true);
    try {
      const updated = await invoiceApi.getInvoiceById(invoice.id);
      if (updated) {
        onStatusChange?.(updated.status, updated);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!invoice) return null;

  return (
    <div className="invoice-card">
      {/* Invoice Header */}
      <div className="inv-status-header">
        <div className={`inv-status-badge status-${invoice.status}`}>
          {invoice.status === 'PENDING' && 'در انتظار واریز در بلاکچین ⏳'}
          {invoice.status === 'PAID' && 'پرداخت و تسویه تایید شد ✅'}
          {invoice.status === 'UNDERPAID' && 'کسری مبلغ واریزی ⚠️'}
          {invoice.status === 'EXPIRED' && 'فاکتور منقضی شده ⌛'}
        </div>
        {invoice.status === 'PENDING' && (
          <div className="timer-box">⏱ {formatTimer(timeLeft)}</div>
        )}
      </div>

      {/* Amount Hero */}
      <div className="amount-hero">
        <div className="amount-crypto">
          {invoice.crypto_amount} {invoice.currency_symbol || invoice.currency_id}
        </div>
        <div className="amount-usd">
          معادل ${parseFloat(invoice.amount_usd || 0).toFixed(2)} USD در شبکه{' '}
          {invoice.network_name || invoice.network_id?.toUpperCase()}
        </div>
      </div>

      {/* Raw Blockchain Details - بدون اسکن سریع و صرفاً با آدرس خام */}
      <div className="info-rows">
        <div className="info-row">
          <span className="label">شماره فاکتور:</span>
          <span className="val">{invoice.invoice_number}</span>
        </div>

        {(invoice.telegram_username || invoice.telegram_id || invoice.user_id) && (
          <div className="info-row">
            <span className="label">کاربر تلگرام:</span>
            <span className="val" style={{ color: 'var(--cyan-glow)', fontWeight: 700 }}>
              {invoice.telegram_username ? `@${invoice.telegram_username.replace(/^@/, '')}` : ''}
              {invoice.telegram_id ? ` (ID: ${invoice.telegram_id})` : (!invoice.telegram_username && invoice.user_id ? `ID: ${invoice.user_id}` : '')}
            </span>
          </div>
        )}

        <div className="info-row">
          <span className="label">آدرس والت خام (Deposit Address):</span>
          <span className="val" style={{ wordBreak: 'break-all' }}>
            <span style={{ fontSize: '0.8rem' }}>{invoice.pay_address}</span>
            <button
              className="copy-icon-btn"
              onClick={() => onCopy(invoice.pay_address, 'آدرس کیف پول')}
              title="کپی آدرس خام والت"
            >
              کپی آدرس
            </button>
          </span>
        </div>

        {invoice.pay_memo && (
          <div className="info-row">
            <span className="label">کامنت / ممو الزامی (Memo):</span>
            <span className="val" style={{ color: '#fbbf24', fontWeight: 800 }}>
              {invoice.pay_memo}
              <button
                className="copy-icon-btn"
                onClick={() => onCopy(invoice.pay_memo, 'شناسه Memo')}
                title="کپی کامنت / ممو"
              >
                کپی Memo
              </button>
            </span>
          </div>
        )}

      </div>

      {/* Memo Alert Banner for TON vs Unique Address Note for BSC */}
      {invoice.pay_memo ? (
        <div className="memo-alert">
          ⚠️ <strong>نکته واریز در شبکه TON:</strong> هنگام ارسال وجه از والت Tonkeeper یا ربات، حتماً فیلد{' '}
          <strong>Comment / Memo</strong> را برابر <code>{invoice.pay_memo}</code> قرار دهید تا واریزی به این فاکتور متصل گردد.
        </div>
      ) : (
        <div
          style={{
            margin: '1rem 0',
            padding: '0.75rem 1rem',
            background: 'rgba(6, 182, 212, 0.1)',
            border: '1px solid rgba(6, 182, 212, 0.3)',
            borderRadius: '8px',
            fontSize: '0.82rem',
            color: 'var(--cyan-glow)'
          }}
        >
          💎 <strong>معماری اختصاصی BSC:</strong> این آدرس منحصراً از طریق HD-Wallet برای این فاکتور اشتقاق یافته است. واریز بدون نیاز به هیچ ممو یا کامنت مستقیماً رصد و تسویه می‌گردد.
        </div>
      )}

      {/* Real Live Polling Status */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '1rem',
          padding: '0.75rem 1rem',
          background: 'rgba(0, 0, 0, 0.3)',
          borderRadius: '10px'
        }}
      >
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          {invoice.status === 'PENDING' ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="pulse-dot" style={{ color: 'var(--cyan)' }}></span>
              سیستم در حال پایش لحظه‌ای نود بلاکچین است...
            </span>
          ) : (
            <span>وضعیت نهایی: {invoice.status}</span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn-sim-action"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? 'بررسی...' : '🔄 استعلام مجدد'}
          </button>
          <button className="btn-sim-action" onClick={onReset}>
            فاکتور جدید
          </button>
        </div>
      </div>

      {/* Success Banner */}
      {invoice.status === 'PAID' && (
        <div className="celebrate-card">
          <div className="celebrate-icon">🎉</div>
          <h3 style={{ color: '#34d399', marginBottom: '0.3rem' }}>پرداخت با موفقیت در بلاکچین تایید شد!</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            تراکنش واریزی توسط ناظر کشف شد و وضعیت فاکتور به صورت واقعی به PAID تغییر یافت.
          </p>
        </div>
      )}
    </div>
  );
}
